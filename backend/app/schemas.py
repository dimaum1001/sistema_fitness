"""
Schemas (Pydantic) usados na API.

Observações importantes:
- A ficha (planos/sessões/exercícios) é o que foi *prescrito* pelo professor.
- A execução (training_executions + exercise_executions) é o que foi *realizado* pelo aluno e deve
  permanecer no histórico mesmo que o professor altere a ficha depois.

Por isso, `TrainingExecutionCreate` aceita `exercises` com `performed` (ex.: set_details com reps/carga).
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr

from .models import UserType, ExerciseType, ExecutionStatus

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    type: UserType

class UserOut(UserBase):
    id: int
    type: UserType
    class Config:
        from_attributes = True


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class ConsentStatus(BaseModel):
    accepted: bool
    terms_version: str
    privacy_version: str
    sensitive_version: str
    terms_accepted_at: Optional[datetime] = None
    privacy_accepted_at: Optional[datetime] = None
    sensitive_accepted_at: Optional[datetime] = None


class ConsentUpdate(BaseModel):
    accept_terms: bool
    accept_privacy: bool
    accept_sensitive: bool

class ExerciseBase(BaseModel):
    name: str
    type: ExerciseType = ExerciseType.MUSCULACAO
    group: Optional[str] = None
    description: Optional[str] = None
    tips: Optional[str] = None
    video_url: Optional[str] = None
    endurance_params: Optional[Dict[str, Any]] = None  # campos livres para corrida/pedal

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ExerciseType] = None
    group: Optional[str] = None
    description: Optional[str] = None
    tips: Optional[str] = None
    video_url: Optional[str] = None
    endurance_params: Optional[Dict[str, Any]] = None

class ExerciseOut(ExerciseBase):
    id: int
    professor_id: Optional[int] = None
    active: Optional[bool] = None
    class Config:
        from_attributes = True

class TrainingPlanBase(BaseModel):
    name: str
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None

class TrainingPlanCreate(TrainingPlanBase):
    student_id: int

class TrainingPlanOut(TrainingPlanBase):
    id: int
    class Config:
        from_attributes = True

class TrainingSessionBase(BaseModel):
    name: str
    sequence: Optional[int] = None
    main_type: Optional[str] = None
    notes: Optional[str] = None

class TrainingSessionCreate(TrainingSessionBase):
    plan_id: int

class TrainingSessionOut(TrainingSessionBase):
    id: int
    class Config:
        from_attributes = True


class TrainingSessionExerciseBase(BaseModel):
    # session_id é fornecido na rota; deixamos opcional para não quebrar validação do body.
    session_id: Optional[int] = None
    exercise_id: int
    order: Optional[int] = None
    params: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class TrainingSessionExerciseCreate(TrainingSessionExerciseBase):
    pass


class TrainingSessionExerciseOut(TrainingSessionExerciseBase):
    id: int
    class Config:
        from_attributes = True


class TrainingSessionExerciseUpdate(BaseModel):
    order: Optional[int] = None
    params: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class ExerciseExecutionIn(BaseModel):
    # Referência ao item da ficha (TrainingSessionExercise.id) que foi executado.
    session_exercise_id: int
    # Dados do aluno (livre/estruturado). Para musculação usamos principalmente:
    # { "set_details": [ { "reps": "...", "load": "..." }, ... ] }
    performed: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
class TrainingExecutionBase(BaseModel):
    student_id: int
    session_id: int
    status: ExecutionStatus = ExecutionStatus.CONCLUIDO
    rpe: Optional[int] = None
    comment: Optional[str] = None

class TrainingExecutionCreate(TrainingExecutionBase):
    # Lista opcional com o que foi realizado em cada exercício da sessão.
    # Se vier vazio/nulo, a API ainda cria o snapshot, mas não terá cargas/reps para evolução.
    exercises: Optional[List[ExerciseExecutionIn]] = None

class TrainingExecutionOut(TrainingExecutionBase):
    id: int
    executed_at: datetime
    class Config:
        from_attributes = True


class ExecutionExerciseBrief(BaseModel):
    id: int
    order: int
    name: str
    type: ExerciseType
    exercise_id: Optional[int] = None
    group: Optional[str] = None
    prescribed_params: Optional[Dict[str, Any]] = None
    # Dados realizados (do aluno) daquele exercício naquele dia.
    performed: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    class Config:
        from_attributes = True


class TrainingExecutionReport(BaseModel):
    id: int
    student_id: int
    session_id: int
    session_name: Optional[str] = None
    plan_name: Optional[str] = None
    executed_at: datetime
    status: ExecutionStatus
    rpe: Optional[int] = None
    comment: Optional[str] = None
    exercises: List[ExecutionExerciseBrief] = []
    class Config:
        from_attributes = True


class ExerciseEvolutionItem(BaseModel):
    # Item agregado por exercício, para comparar evolução de carga e reps ao longo do tempo.
    exercise_id: int
    name: str
    type: ExerciseType
    group: Optional[str] = None
    last_executed_at: Optional[datetime] = None
    last_load: Optional[str] = None
    last_load_value: Optional[float] = None
    best_load: Optional[str] = None
    best_load_value: Optional[float] = None
    prev_load: Optional[str] = None
    prev_load_value: Optional[float] = None
    delta_load_value: Optional[float] = None
    last_reps: Optional[str] = None
    last_reps_value: Optional[float] = None
    best_reps: Optional[str] = None
    best_reps_value: Optional[float] = None
    prev_reps: Optional[str] = None
    prev_reps_value: Optional[float] = None
    delta_reps_value: Optional[float] = None
    total_executions: int = 0


class LastExercisePerformanceItem(BaseModel):
    # Última execução (por exercício) com dados realizados.
    exercise_id: int
    name: str
    type: ExerciseType
    group: Optional[str] = None
    executed_at: datetime
    performed: Optional[Dict[str, Any]] = None


class StudentOut(BaseModel):
    id: int
    user_id: int
    professor_id: int
    name: str
    email: EmailStr
    type: UserType


class SessionExerciseDetail(BaseModel):
    id: int
    order: int
    params: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    exercise: ExerciseOut

    class Config:
        from_attributes = True


class SessionWithExercises(BaseModel):
    id: int
    plan_id: int
    student_id: int
    name: str
    sequence: Optional[int] = None
    main_type: Optional[str] = None
    notes: Optional[str] = None
    exercises: List[SessionExerciseDetail]

    class Config:
        from_attributes = True
