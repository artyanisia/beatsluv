from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.database import get_db_connection

# Security configuration
SECRET_KEY = "your-secret-key-here-change-in-production"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be 72 bytes or fewer",
        )

    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user data."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email: str = payload.get("sub")
        if user_email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, email, role FROM users WHERE email = %s", (user_email,))
            user = cursor.fetchone()
            if user is None:
                raise credentials_exception
            
            return {
                "id": user[0],
                "email": user[1],
                "role": user[2]
            }
    finally:
        conn.close()


def authenticate_user(email: str, password: str):
    """Authenticate user with email and password."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, email, password_hash, role FROM users WHERE email = %s", (email.lower(),))
            user = cursor.fetchone()
            
            if not user:
                return False
            
            if not verify_password(password, user[2]):
                return False
            
            return {
                "id": user[0],
                "email": user[1],
                "role": user[3]
            }
    finally:
        conn.close()


def user_exists(email: str) -> bool:
    """Return whether a user account exists for the given email."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM users WHERE email = %s", (email.lower(),))
            return cursor.fetchone() is not None
    finally:
        conn.close()


def create_user(email: str, password: str, role: str = "USER"):
    """Create a new user."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = %s", (email.lower(),))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Create new user
            hashed_password = get_password_hash(password)
            cursor.execute(
                "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s) RETURNING id",
                (email.lower(), hashed_password, role)
            )
            user_id = cursor.fetchone()[0]
            conn.commit()
            
            return {
                "id": user_id,
                "email": email.lower(),
                "role": role
            }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
