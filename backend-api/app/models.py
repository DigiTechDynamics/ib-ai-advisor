from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    mobile_number = Column(String, unique=True, index=True)
    pin_hash = Column(String)
    name = Column(String)
    risk_tolerance = Column(String, default="MEDIUM") # LOW, MEDIUM, HIGH
    monthly_income_target = Column(Float, default=0.0)
    financial_goals = Column(String, default="[]") # JSON string of goals

    accounts = relationship("Account", back_populates="owner")

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    account_number = Column(String, unique=True, index=True)
    balance = Column(Float, default=0.0)
    currency = Column(String) # 'USD' or 'ZWG'
    account_type = Column(String) # 'CHECKING'

    owner = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    amount = Column(Float)
    currency = Column(String)
    transaction_type = Column(String)
    description = Column(String)
    ai_category = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    account = relationship("Account", back_populates="transactions")

class Beneficiary(Base):
    __tablename__ = "beneficiaries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    account_number = Column(String)
    bank_name = Column(String)
    
    owner = relationship("User")
