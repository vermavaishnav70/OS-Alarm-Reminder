"""
models.py
─────────
Shared Pydantic data models for the Chronos OS API.
"""

from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class Alarm(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    time: str                              # "HH:MM"
    label: str = ""
    sound: str = "Classic Beep"
    repeat: List[str] = []                 # ["Mon","Tue",...]  empty = once
    active: bool = True
    ringing: bool = False


class AlarmCreate(BaseModel):
    time: str
    label: str = ""
    sound: str = "Classic Beep"
    repeat: List[str] = []
    active: bool = True


class AlarmUpdate(BaseModel):
    active: Optional[bool] = None
    label: Optional[str] = None
    sound: Optional[str] = None
    repeat: Optional[List[str]] = None


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    date: str = ""                         # "YYYY-MM-DD"
    time: str = ""                         # "HH:MM"
    reminder: int = 10                     # minutes before
    done: bool = False
    color: str = "#6366f1"
    reminder_fired: bool = False           # track if reminder was already sent


class TaskCreate(BaseModel):
    title: str
    date: str = ""
    time: str = ""
    reminder: int = 10
    color: str = "#6366f1"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    reminder: Optional[int] = None
    done: Optional[bool] = None
    color: Optional[str] = None
