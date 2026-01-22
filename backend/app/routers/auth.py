from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserType, Student
from ..schemas import UserCreate, UserOut, Token
from ..core.security import get_password_hash, verify_password, create_access_token, get_current_user
from ..core.config import get_settings

router = APIRouter()

@router.post("/register_professor", response_model=UserOut)
def register_professor(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas admin pode cadastrar professores")
    if payload.type != UserType.PROFESSOR:
        raise HTTPException(status_code=400, detail="type deve ser PROFESSOR")
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        type=payload.type,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/register_aluno", response_model=UserOut)
def register_aluno(payload: UserCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode cadastrar alunos")
    if payload.type != UserType.ALUNO:
        raise HTTPException(status_code=400, detail="type deve ser ALUNO")
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        type=payload.type,
    )
    db.add(user)
    db.flush()
    student = Student(user_id=user.id, professor_id=current.id)
    db.add(student)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    if not user.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada")
    settings = get_settings()
    access_token = create_access_token(
        data={"sub": str(user.id), "type": user.type.value},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(access_token=access_token)

@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current
