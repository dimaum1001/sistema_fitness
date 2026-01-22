"""
Modelos SQLAlchemy do Sistema Fitness Total.

Principais conceitos:
- Plano/Sessão/Exercício de sessão: representam a "ficha" (programa prescrito pelo professor).
- Execução (TrainingExecution): um registro de que o aluno realizou uma sessão em uma data.
- Execução de exercício (ExerciseExecution): guarda um *snapshot* do que foi prescrito na época
  + o que o aluno realizou (cargas/reps etc.). Isso garante histórico mesmo que a ficha mude depois.

Para manter histórico, usamos "arquivamento" (soft delete) em vez de apagar registros:
- TrainingPlanMeta / TrainingSessionMeta / TrainingSessionExerciseMeta marcam itens como ativos/inativos.
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SAEnum, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from .database import Base

class UserType(str, Enum):
    ADMIN = "ADMIN"
    PROFESSOR = "PROFESSOR"
    ALUNO = "ALUNO"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    type = Column(SAEnum(UserType), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)

    student = relationship("Student", back_populates="user", uselist=False, foreign_keys="Student.user_id")

class UserConsent(Base):
    __tablename__ = "user_consents"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    terms_version = Column(String(20), nullable=False)
    privacy_version = Column(String(20), nullable=False)
    sensitive_version = Column(String(20), nullable=False)
    terms_accepted_at = Column(DateTime, nullable=True)
    privacy_accepted_at = Column(DateTime, nullable=True)
    sensitive_accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    professor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="student")
    professor = relationship("User", foreign_keys=[professor_id])

class ExerciseType(str, Enum):
    MUSCULACAO = "MUSCULACAO"
    CORRIDA = "CORRIDA"
    PEDAL = "PEDAL"
    OUTRO = "OUTRO"

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True, index=True)
    professor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(120), nullable=False)
    type = Column(SAEnum(ExerciseType), default=ExerciseType.MUSCULACAO)
    group = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)
    tips = Column(Text, nullable=True)
    video_url = Column(String(255), nullable=True)
    endurance_params = Column(JSON, nullable=True)  # Para corrida/pedal: duração, zona, ritmo, tipo de treino etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    professor = relationship("User")

class TrainingPlan(Base):
    __tablename__ = "training_plans"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    name = Column(String(120), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    student = relationship("Student")
    sessions = relationship("TrainingSession", back_populates="plan")

class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("training_plans.id"), nullable=False)
    name = Column(String(120), nullable=False)
    sequence = Column(Integer, nullable=True)
    main_type = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    plan = relationship("TrainingPlan", back_populates="sessions")
    items = relationship("TrainingSessionExercise", back_populates="session")

class TrainingSessionExercise(Base):
    __tablename__ = "training_session_exercises"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    order = Column(Integer, default=1)
    params = Column(JSON, nullable=True)  # Parâmetros estruturados (séries/rep/carga ou duração/pace etc.)
    notes = Column(Text, nullable=True)

    session = relationship("TrainingSession", back_populates="items")
    exercise = relationship("Exercise")

class ExecutionStatus(str, Enum):
    CONCLUIDO = "CONCLUIDO"
    PARCIAL = "PARCIAL"
    NAO_REALIZADO = "NAO_REALIZADO"

class TrainingExecution(Base):
    __tablename__ = "training_executions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("training_sessions.id"), nullable=False)
    executed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(SAEnum(ExecutionStatus), default=ExecutionStatus.CONCLUIDO)
    rpe = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)

    student = relationship("Student")
    session = relationship("TrainingSession")

class ExerciseExecution(Base):
    __tablename__ = "exercise_executions"
    id = Column(Integer, primary_key=True, index=True)
    training_execution_id = Column(Integer, ForeignKey("training_executions.id"), nullable=False)
    session_exercise_id = Column(Integer, ForeignKey("training_session_exercises.id"), nullable=False)
    data = Column(Text, nullable=True)  # JSON em string
    notes = Column(Text, nullable=True)

    training_execution = relationship("TrainingExecution")
    session_exercise = relationship("TrainingSessionExercise")


class ExerciseMeta(Base):
    # Metadados para arquivamento (soft delete) de exercicios da biblioteca.
    __tablename__ = "exercise_meta"
    exercise_id = Column(Integer, ForeignKey("exercises.id"), primary_key=True)
    active = Column(Boolean, default=True)
    archived_at = Column(DateTime, nullable=True)

    exercise = relationship("Exercise")


class TrainingPlanMeta(Base):
    # Metadados para arquivamento (soft delete) de plano.
    __tablename__ = "training_plan_meta"
    plan_id = Column(Integer, ForeignKey("training_plans.id"), primary_key=True)
    active = Column(Boolean, default=True)
    archived_at = Column(DateTime, nullable=True)

    plan = relationship("TrainingPlan")


class TrainingSessionMeta(Base):
    # Metadados para arquivamento (soft delete) de sessão.
    __tablename__ = "training_session_meta"
    session_id = Column(Integer, ForeignKey("training_sessions.id"), primary_key=True)
    active = Column(Boolean, default=True)
    archived_at = Column(DateTime, nullable=True)

    session = relationship("TrainingSession")


class TrainingSessionExerciseMeta(Base):
    # Metadados para arquivamento (soft delete) do exercício dentro da sessão.
    # `replaced_by_id` permite versionar: quando o professor "edita" o item, criamos um novo
    # TrainingSessionExercise e marcamos o antigo como inativo apontando para o novo.
    __tablename__ = "training_session_exercise_meta"
    session_exercise_id = Column(Integer, ForeignKey("training_session_exercises.id"), primary_key=True)
    active = Column(Boolean, default=True)
    archived_at = Column(DateTime, nullable=True)
    replaced_by_id = Column(Integer, ForeignKey("training_session_exercises.id"), nullable=True)

    session_exercise = relationship("TrainingSessionExercise", foreign_keys=[session_exercise_id])
