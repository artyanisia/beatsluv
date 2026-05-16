from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from app.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    create_access_token,
    create_user,
    user_exists,
    verify_token
)

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


class UserSignup(BaseModel):
    email: EmailStr
    password: str
    

class UserResponse(BaseModel):
    id: int
    email: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class UserExistsResponse(BaseModel):
    exists: bool


@router.get("/exists", response_model=UserExistsResponse)
async def check_user_exists(email: EmailStr):
    """Check whether an email already has a BeatsLuv account."""
    return UserExistsResponse(exists=user_exists(email))


@router.post("/signup", response_model=UserResponse)
async def signup(user_data: UserSignup):
    """Register a new user."""
    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    try:
        user = create_user(user_data.email, user_data.password)
        return UserResponse(**user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user"
        )


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    """Login endpoint that returns JWT token."""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user)
    }


@router.post("/login", response_model=Token)
async def login(user_data: UserSignup):
    """Alternative login endpoint that takes JSON data."""
    user = authenticate_user(user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user)
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: dict = Depends(verify_token)):
    """Get current user information."""
    return UserResponse(**current_user)


@router.get("/protected")
async def protected_route(current_user: dict = Depends(verify_token)):
    """Example of a protected route."""
    return {"message": f"Hello {current_user['email']}, this is a protected route!"}
