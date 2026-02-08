# Type stubs for GenLayer module
# Helps Pylance/VSCode understand GenLayer API

from typing import Any, Callable, TypeVar

T = TypeVar('T')

class Contract:
    """Base class for GenLayer intelligent contracts"""
    pass

class _Public:
    """Decorator for public contract methods"""
    @property
    def write(self) -> Callable[[Callable[..., T]], Callable[..., T]]: ...
    @property
    def view(self) -> Callable[[Callable[..., T]], Callable[..., T]]: ...

class _Nondet:
    """Non-deterministic operations (LLM prompts)"""
    def exec_prompt(self, prompt: str) -> str: ...

class _EqPrinciple:
    """Equivalence principle for consensus"""
    def strict_eq(self, func: Callable[[], T]) -> T: ...

class _GL:
    """Main GenLayer API object"""
    Contract = Contract
    public: _Public
    nondet: _Nondet
    eq_principle: _EqPrinciple

# Export as 'gl' when using: from genlayer import *
gl: _GL
