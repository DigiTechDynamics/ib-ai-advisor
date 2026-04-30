from fastapi import FastAPI, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from . import models, database
from pydantic import BaseModel
import os
import datetime
import csv
import io
import json
import random
from typing import List, Optional

try:
    from google import genai
except ImportError:
    genai = None

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="IB AI Advisor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    mobile_number: str
    pin: str

class TransferRequest(BaseModel):
    source_account_id: int
    amount: float
    destination_account_number: str
    description: str

class BulkTransferItem(BaseModel):
    destination_account_number: str
    amount: float
    description: str

class BulkTransferRequest(BaseModel):
    source_account_id: int
    payments: list[BulkTransferItem]

class AirtimeRequest(BaseModel):
    account_id: int
    network: str
    phone_number: str
    amount: float

class BillPaymentRequest(BaseModel):
    account_id: int
    biller_name: str
    account_reference: str
    amount: float

class BeneficiaryCreateRequest(BaseModel):
    user_id: int
    name: str
    account_number: str
    bank_name: str

class UserProfileUpdateRequest(BaseModel):
    user_id: int
    risk_tolerance: str # LOW, MEDIUM, HIGH
    monthly_income_target: float
    financial_goals: List[dict] # [{name: string, target: float, current: float}]

class SimulationRequest(BaseModel):
    monthly_savings: float
    investment_amount: float
    horizon_years: int
    expected_return: float # e.g. 0.08 for 8%

@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(database.get_db)):
    # Mock authentication for MVP
    user = db.query(models.User).filter(models.User.mobile_number == req.mobile_number).first()
    if not user:
        # Create a mock user if none exists
        user = models.User(mobile_number=req.mobile_number, pin_hash="hashed_pin", name="Tendai User")
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create mock accounts
        usd_acc = models.Account(user_id=user.id, account_number="USD123456", balance=500.0, currency="USD", account_type="CHECKING")
        zig_acc = models.Account(user_id=user.id, account_number="ZIG654321", balance=15000.0, currency="ZWG", account_type="CHECKING")
        db.add_all([usd_acc, zig_acc])
        db.commit()
        db.refresh(usd_acc)
        db.refresh(zig_acc)

        # Mock initial transactions
        tx1 = models.Transaction(account_id=zig_acc.id, amount=-150.0, currency="ZWG", transaction_type="DEBIT", description="OK MART HRE 0293", ai_category="Groceries")
        tx2 = models.Transaction(account_id=zig_acc.id, amount=-50.0, currency="ZWG", transaction_type="DEBIT", description="ZESA PREPAID TOKENS", ai_category="Utilities")
        db.add_all([tx1, tx2])
        db.commit()

    return {"token": f"mock_token_{user.id}", "user_id": user.id, "name": user.name}

@app.get("/api/accounts/summary")
def get_accounts_summary(user_id: int, db: Session = Depends(database.get_db)):
    accounts = db.query(models.Account).filter(models.Account.user_id == user_id).all()
    return [{"id": a.id, "account_number": a.account_number, "balance": a.balance, "currency": a.currency, "account_type": a.account_type} for a in accounts]

def categorize_transaction_ai(description: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not genai or not api_key:
        return "Uncategorized (Mock AI)"
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f'Categorize this bank transaction description into exactly one short category (e.g., Groceries, Utilities, Transport, Dining, Transfer, Income, Entertainment). Respond ONLY with the category name. Description: "{description}"'
        )
        return response.text.strip()
    except Exception as e:
        print(f"AI categorization failed: {e}")
        return "Uncategorized (AI Error)"

@app.post("/api/transactions/transfer")
def transfer_funds(req: TransferRequest, db: Session = Depends(database.get_db)):
    source = db.query(models.Account).filter(models.Account.id == req.source_account_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source account not found")
    if source.balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    # Destination could be internal or external (mocking external if not found)
    dest = db.query(models.Account).filter(models.Account.account_number == req.destination_account_number).first()
    
    # Calculate IMTT (assume 2% for ZiG if amount > 100)
    imtt = 0.0
    if source.currency == "ZWG" and req.amount > 100:
        imtt = req.amount * 0.02
        if source.balance < (req.amount + imtt):
             raise HTTPException(status_code=400, detail="Insufficient funds to cover IMTT tax")

    # Deduct from source
    source.balance -= (req.amount + imtt)

    # Add to dest if internal
    if dest:
        # In a real app we'd handle cross-currency FX here. For MVP assume same currency transfer if internal
        if dest.currency == source.currency:
            dest.balance += req.amount
        else:
            raise HTTPException(status_code=400, detail="Cross-currency transfers not supported yet")
    
    # Use AI to categorize
    ai_cat = categorize_transaction_ai(req.description)

    tx_debit = models.Transaction(
        account_id=source.id, 
        amount=-req.amount, 
        currency=source.currency, 
        transaction_type="TRANSFER_OUT", 
        description=req.description,
        ai_category=ai_cat
    )
    db.add(tx_debit)

    if imtt > 0:
        tx_tax = models.Transaction(
            account_id=source.id, 
            amount=-imtt, 
            currency=source.currency, 
            transaction_type="TAX", 
            description="IMTT Tax",
            ai_category="Taxes"
        )
        db.add(tx_tax)

    if dest:
        tx_credit = models.Transaction(
            account_id=dest.id, 
            amount=req.amount, 
            currency=dest.currency, 
            transaction_type="TRANSFER_IN", 
            description=f"Transfer from {source.account_number}",
            ai_category="Transfer"
        )
        db.add(tx_credit)

    db.commit()
    return {"message": "Transfer successful", "new_balance": source.balance, "imtt_charged": imtt}

@app.post("/api/transactions/bulk_transfer")
def bulk_transfer_funds(req: BulkTransferRequest, db: Session = Depends(database.get_db)):
    source = db.query(models.Account).filter(models.Account.id == req.source_account_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source account not found")

    total_amount = sum(p.amount for p in req.payments)

    # Calculate total IMTT (2% on ZWG transfers > 100)
    total_imtt = 0.0
    if source.currency == "ZWG":
        total_imtt = sum(p.amount * 0.02 for p in req.payments if p.amount > 100)

    if source.balance < (total_amount + total_imtt):
        raise HTTPException(status_code=400, detail=f"Insufficient funds. Total required: {total_amount + total_imtt:.2f} (incl. IMTT: {total_imtt:.2f})")

    # Deduct total from source upfront
    source.balance -= (total_amount + total_imtt)

    results = []
    for payment in req.payments:
        dest = db.query(models.Account).filter(models.Account.account_number == payment.destination_account_number).first()
        ai_cat = categorize_transaction_ai(payment.description)

        tx_debit = models.Transaction(
            account_id=source.id,
            amount=-payment.amount,
            currency=source.currency,
            transaction_type="BULK_TRANSFER_OUT",
            description=payment.description,
            ai_category=ai_cat
        )
        db.add(tx_debit)

        if dest and dest.currency == source.currency:
            dest.balance += payment.amount
            tx_credit = models.Transaction(
                account_id=dest.id,
                amount=payment.amount,
                currency=dest.currency,
                transaction_type="TRANSFER_IN",
                description=f"Bulk transfer from {source.account_number}",
                ai_category="Transfer"
            )
            db.add(tx_credit)

        imtt_item = payment.amount * 0.02 if source.currency == "ZWG" and payment.amount > 100 else 0.0
        if imtt_item > 0:
            db.add(models.Transaction(
                account_id=source.id, amount=-imtt_item,
                currency=source.currency, transaction_type="TAX",
                description="IMTT Tax (Bulk)", ai_category="Taxes"
            ))

        results.append({"destination": payment.destination_account_number, "amount": payment.amount, "status": "processed"})

    db.commit()
    return {
        "message": f"{len(req.payments)} payments processed successfully",
        "new_balance": source.balance,
        "total_imtt_charged": total_imtt,
        "results": results
    }

@app.get("/api/transactions/{account_id}")
def get_transactions(account_id: int, db: Session = Depends(database.get_db)):
    transactions = db.query(models.Transaction).filter(models.Transaction.account_id == account_id).order_by(models.Transaction.timestamp.desc()).all()
    return [{
        "id": t.id,
        "amount": t.amount,
        "currency": t.currency,
        "transaction_type": t.transaction_type,
        "description": t.description,
        "ai_category": t.ai_category,
        "timestamp": t.timestamp.isoformat()
    } for t in transactions]

@app.post("/api/airtime/buy")
def buy_airtime(req: AirtimeRequest, db: Session = Depends(database.get_db)):
    source = db.query(models.Account).filter(models.Account.id == req.account_id).first()
    if not source or source.balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    source.balance -= req.amount
    
    tx = models.Transaction(
        account_id=source.id,
        amount=-req.amount,
        currency=source.currency,
        transaction_type="AIRTIME",
        description=f"{req.network} Airtime: {req.phone_number}",
        ai_category="Utilities"
    )
    db.add(tx)
    db.commit()
    return {"message": "Airtime purchased successfully", "new_balance": source.balance}

@app.post("/api/bills/pay")
def pay_bill(req: BillPaymentRequest, db: Session = Depends(database.get_db)):
    source = db.query(models.Account).filter(models.Account.id == req.account_id).first()
    if not source or source.balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    source.balance -= req.amount
    
    tx = models.Transaction(
        account_id=source.id,
        amount=-req.amount,
        currency=source.currency,
        transaction_type="BILL_PAYMENT",
        description=f"{req.biller_name} Payment: {req.account_reference}",
        ai_category="Utilities"
    )
    db.add(tx)
    db.commit()
    return {"message": "Bill paid successfully", "new_balance": source.balance}

@app.post("/api/beneficiaries")
def add_beneficiary(req: BeneficiaryCreateRequest, db: Session = Depends(database.get_db)):
    ben = models.Beneficiary(
        user_id=req.user_id,
        name=req.name,
        account_number=req.account_number,
        bank_name=req.bank_name
    )
    db.add(ben)
    db.commit()
    return {"message": "Beneficiary added successfully"}

@app.get("/api/beneficiaries")
def get_beneficiaries(user_id: int, db: Session = Depends(database.get_db)):
    bens = db.query(models.Beneficiary).filter(models.Beneficiary.user_id == user_id).all()
    return [{"id": b.id, "name": b.name, "account_number": b.account_number, "bank_name": b.bank_name} for b in bens]

@app.get("/api/user/profile")
def get_user_profile(user_id: int, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "risk_tolerance": user.risk_tolerance,
        "monthly_income_target": user.monthly_income_target,
        "financial_goals": json.loads(user.financial_goals)
    }

@app.post("/api/user/profile")
def update_user_profile(req: UserProfileUpdateRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.risk_tolerance = req.risk_tolerance
    user.monthly_income_target = req.monthly_income_target
    user.financial_goals = json.dumps(req.financial_goals)
    db.commit()
    return {"message": "Profile updated successfully"}

@app.get("/api/advisor/comprehensive")
def get_comprehensive_advice(user_id: int, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    accounts = db.query(models.Account).filter(models.Account.user_id == user_id).all()
    total_balance_zwg = sum(a.balance for a in accounts if a.currency == "ZWG")
    total_balance_usd = sum(a.balance for a in accounts if a.currency == "USD")
    
    # 1. Spending Habits Analysis
    all_txs = []
    now = datetime.datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - datetime.timedelta(days=1)).replace(day=1)
    
    for acc in accounts:
        txs = db.query(models.Transaction).filter(models.Transaction.account_id == acc.id, models.Transaction.amount < 0).all()
        all_txs.extend(txs)
    
    total_spent = sum(abs(t.amount) for t in all_txs)
    
    this_month_txs = [t for t in all_txs if t.timestamp >= this_month_start]
    last_month_txs = [t for t in all_txs if last_month_start <= t.timestamp < this_month_start]
    
    this_month_spent = sum(abs(t.amount) for t in this_month_txs)
    last_month_spent = sum(abs(t.amount) for t in last_month_txs)
    
    spending_trend = "stable"
    if last_month_spent > 0:
        change = ((this_month_spent - last_month_spent) / last_month_spent) * 100
        if change > 10: spending_trend = "up"
        elif change < -10: spending_trend = "down"

    cat_spending = {}
    for t in all_txs:
        cat = t.ai_category or "Other"
        cat_spending[cat] = cat_spending.get(cat, 0) + abs(t.amount)
    
    anomalies = []
    # Dynamic Anomaly Detection
    for cat, amount in cat_spending.items():
        if amount > (total_spent * 0.3) and cat not in ["Transfer", "Income"]:
            anomalies.append(f"High {cat} spending detected: {cat} accounts for { (amount/total_spent)*100:.0f}% of your total expenses.")
    
    if not anomalies:
        anomalies.append("No unusual spending patterns detected. Your expenses are well-distributed.")

    # 2. Budgeting & Saving Strategies
    savings_rate = 0.0
    if user.monthly_income_target > 0:
        savings_rate = (user.monthly_income_target - this_month_spent) / user.monthly_income_target
    
    save_strategy = "Balanced 50/30/20"
    if savings_rate < 0.1:
        save_strategy = "Defensive: Focus on Essential Costs & Emergency Buffer"
    elif savings_rate > 0.4:
        save_strategy = "Aggressive: High-Growth Investment & Wealth Building"

    # 3. Investment Recommendations (Risk-Based)
    investments = []
    rt = user.risk_tolerance
    if rt == "LOW":
        investments = [
            {"name": "RBZ Savings Bonds", "yield": "7.5% p.a.", "risk": "Minimal", "description": "Government-backed security with guaranteed returns."},
            {"name": "USD Fixed Deposit", "yield": "5.0% p.a.", "risk": "Low", "description": "Secure USD returns for conservative capital preservation."}
        ]
    elif rt == "MEDIUM":
        investments = [
            {"name": "Old Mutual Unit Trust", "yield": "18-22% p.a.", "risk": "Moderate", "description": "Diversified portfolio of stocks and money market instruments."},
            {"name": "ZSE Top 10 Index Fund", "yield": "Market Linked", "risk": "Moderate", "description": "Exposure to the largest companies in Zimbabwe."}
        ]
    else: # HIGH
        investments = [
            {"name": "VFEX Tech Basket", "yield": "Variable (USD)", "risk": "High", "description": "Aggressive growth focused on regional technology startups."},
            {"name": "Crypto Diversified Fund", "yield": "Highly Volatile", "risk": "Aggressive", "description": "Exposure to digital assets like BTC and ETH for maximum growth."}
        ]

    # 4. Market Awareness
    market_insights = get_market_latest()
    
    # 5. Goal Progress
    goals = json.loads(user.financial_goals)
    for g in goals:
        # Simple logic: assume current balance contributes to goals
        if "Emergency" in g['name']:
            g['current'] = total_balance_zwg + (total_balance_usd * 25) # Mocked conversion
        g['percent'] = min(100, round((g['current'] / g['target']) * 100))

    return {
        "spending_analysis": {
            "total_spent": round(total_spent, 2),
            "this_month_spent": round(this_month_spent, 2),
            "spending_trend": spending_trend,
            "top_categories": sorted(cat_spending.items(), key=lambda x: x[1], reverse=True)[:3],
            "anomalies": anomalies
        },
        "budgeting": {
            "savings_rate": f"{savings_rate*100:.1f}%",
            "strategy": save_strategy,
            "advice": "To boost your savings, consider the 'Rule of 72' for long-term growth and automate a 15% transfer to your savings account."
        },
        "investments": investments,
        "market": market_insights,
        "goals": goals,
        "risk_profile": rt
    }

@app.get("/api/ai/advisor")
def get_ai_recommendation(user_id: int, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    accounts = db.query(models.Account).filter(models.Account.user_id == user_id).all()
    zig_balance = sum(a.balance for a in accounts if a.currency == "ZWG")
    usd_balance = sum(a.balance for a in accounts if a.currency == "USD")

    # Get recent spending for context
    all_txs = []
    for acc in accounts:
        txs = db.query(models.Transaction).filter(models.Transaction.account_id == acc.id, models.Transaction.amount < 0).all()
        all_txs.extend(txs)

    total_spending = sum(abs(t.amount) for t in all_txs)
    cat_spending: dict[str, float] = {}
    for t in all_txs:
        cat = t.ai_category or "Uncategorized"
        cat_spending[cat] = cat_spending.get(cat, 0) + abs(t.amount)
    top_category = max(cat_spending, key=cat_spending.get) if cat_spending else "General"

    if zig_balance > 10000:
        return {
            "type": "Savings Opportunity",
            "title": "Invest in RBZ Treasury Bills",
            "recommendation": f"Move ZWG {zig_balance * 0.3:,.0f} into a 90-day ZiG Treasury Bill.",
            "explanation": f"You hold ZWG {zig_balance:,.2f} idle. At current rates, this is losing value to inflation. By moving 30% to a TB, you earn guaranteed interest. Your top spending is {top_category}, suggesting you can afford this shift.",
            "confidence": 0.90,
            "risks": "90-day lock-in period. Interest rates are subject to RBZ monetary policy changes."
        }
    elif usd_balance > 200:
        return {
            "type": "Investment Tip",
            "title": "USD Capital Growth",
            "recommendation": f"Allocate USD {usd_balance * 0.4:,.0f} to the Old Mutual USD Fund.",
            "explanation": f"With ${usd_balance:,.2f} in liquidity, you are well-positioned for USD-denominated growth. The OM Fund historically outperforms inflation with low risk.",
            "confidence": 0.85,
            "risks": "Market fluctuations can affect daily valuations, though the fund is professionally managed."
        }
    else:
        return {
            "type": "Budgeting Alert",
            "title": "Cash Flow Optimization",
            "recommendation": "Reduce non-essential 'Entertainment' spending by 15%.",
            "explanation": f"Total spending is ZWG {total_spending:,.2f}. Based on your {user.risk_tolerance if user else 'MEDIUM'} risk profile, increasing your liquid buffer should be a priority.",
            "confidence": 0.78,
            "risks": "Requires strict lifestyle adjustments for the next 60 days."
        }

@app.get("/api/dashboard/insights")
def get_spending_insights(user_id: int, db: Session = Depends(database.get_db)):
    """Returns spending breakdown by AI category across all accounts for charts."""
    accounts = db.query(models.Account).filter(models.Account.user_id == user_id).all()
    cat_spending: dict[str, float] = {}
    recent_daily: dict[str, float] = {}

    for acc in accounts:
        txs = db.query(models.Transaction).filter(
            models.Transaction.account_id == acc.id,
            models.Transaction.amount < 0
        ).order_by(models.Transaction.timestamp.desc()).limit(100).all()

        for t in txs:
            cat = t.ai_category or "Uncategorized"
            cat_spending[cat] = cat_spending.get(cat, 0) + abs(t.amount)
            day_key = t.timestamp.strftime("%Y-%m-%d") if t.timestamp else "Unknown"
            recent_daily[day_key] = recent_daily.get(day_key, 0) + abs(t.amount)

    sorted_cats = sorted(cat_spending.items(), key=lambda x: x[1], reverse=True)
    return {
        "categories": [{"name": k, "amount": round(v, 2)} for k, v in sorted_cats],
        "daily": [{"date": k, "amount": round(v, 2)} for k, v in sorted(recent_daily.items())],
        "total_spending": round(sum(cat_spending.values()), 2)
    }

@app.get("/api/accounts/statement")
def download_statement(account_id: int, db: Session = Depends(database.get_db)):
    """Downloads transactions for an account as a CSV file."""
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    txs = db.query(models.Transaction).filter(
        models.Transaction.account_id == account_id
    ).order_by(models.Transaction.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Type", "Category", "Amount", "Currency"])
    for t in txs:
        writer.writerow([
            t.timestamp.strftime("%Y-%m-%d %H:%M") if t.timestamp else "",
            t.description,
            t.transaction_type,
            t.ai_category or "",
            t.amount,
            t.currency
        ])

    csv_content = output.getvalue()
    filename = f"statement_{account.account_number}_{datetime.date.today()}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/market/latest")
def get_market_latest():
    """Mock integration with financial market data."""
    return [
        {"symbol": "OMU.ZW", "name": "Old Mutual Ltd", "price": 42.50, "change": 1.2, "type": "Stock", "trend": "Bullish"},
        {"symbol": "DLTA.ZW", "name": "Delta Corp", "price": 120.15, "change": -0.5, "type": "Stock", "trend": "Neutral"},
        {"symbol": "ECO.ZW", "name": "Econet Wireless", "price": 85.00, "change": 2.1, "type": "Stock", "trend": "Strong Bullish"},
        {"symbol": "BTC/USD", "name": "Bitcoin", "price": 64200.0, "change": 1.5, "type": "Crypto", "trend": "Volatile"},
        {"symbol": "GLD", "name": "Gold (SPDR ETF)", "price": 215.40, "change": 0.3, "type": "ETF", "trend": "Safe Haven"},
        {"symbol": "TB-90D", "name": "RBZ 90-Day TB", "price": 18.5, "change": 0.0, "type": "Bond", "yield": "18.5%", "trend": "Fixed"}
    ]

@app.get("/api/market/ai_insight")
def get_market_ai_insight():
    """Uses AI to explain market trends in simple language."""
    market_data = get_market_latest()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not genai or not api_key:
        return {"explanation": "Markets are showing mixed signals today. The ZSE is slightly up, led by tech and consumer staples. Gold remains a strong hedge against local currency fluctuations. Consider diversifying your portfolio across these sectors."}
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"Explain this market data to a beginner investor in simple, encouraging language. Highlight risks and opportunities. Data: {json.dumps(market_data)}"
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp', # Using a stable futuristic model
            contents=prompt
        )
        return {"explanation": response.text.strip()}
    except Exception as e:
        return {"explanation": "Global markets are reacting to inflation data. Local stocks like Econet and Delta are performing well, while Gold continues to act as a safe haven."}

@app.post("/api/advisor/simulate")
def simulate_scenario(req: SimulationRequest):
    """Simulates wealth growth over time."""
    results = []
    current_wealth = 0.0
    for year in range(1, req.horizon_years + 1):
        # Compounding existing wealth + new investments
        current_wealth = (current_wealth + req.investment_amount + (req.monthly_savings * 12)) * (1 + req.expected_return)
        results.append({
            "year": year,
            "wealth": round(current_wealth, 2),
            "contributions": round((req.investment_amount + (req.monthly_savings * 12)) * year, 2)
        })
    return {
        "final_wealth": round(current_wealth, 2),
        "total_contributions": round((req.investment_amount + (req.monthly_savings * 12)) * req.horizon_years, 2),
        "total_interest": round(current_wealth - ((req.investment_amount + (req.monthly_savings * 12)) * req.horizon_years), 2),
        "yearly_breakdown": results
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the IB AI Advisor API"}
