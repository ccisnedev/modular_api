"""modular_api — Use-case-centric toolkit for building modular APIs with Starlette."""

from modular_api.core.health.health_check import (
    HealthCheck,
    HealthCheckResult,
    HealthStatus,
)
from modular_api.core.health.health_handler import health_handler
from modular_api.core.health.health_service import HealthResponse, HealthService
from modular_api.core.logger.logger import (
    LogLevel,
    ModularLogger,
    RequestScopedLogger,
)
from modular_api.core.logger.logging_middleware import logging_middleware
from modular_api.core.metrics.metric import Counter, Gauge, Histogram, MetricSample
from modular_api.core.modular_api import ModularApi
from modular_api.core.metrics.metric_registry import MetricRegistry, MetricsRegistrar
from modular_api.core.metrics.metrics_middleware import metrics_handler, metrics_middleware
from modular_api.core.module_builder import ModuleBuilder
from modular_api.core.registry import ApiRegistry, UseCaseDocMeta, UseCaseRegistration, api_registry
from modular_api.core.use_case_exception import UseCaseException
from modular_api.core.usecase import Input, Output, UseCase
from modular_api.core.usecase_handler import usecase_handler
from modular_api.middlewares.cors import cors_middleware
from modular_api.openapi.openapi import (
    build_openapi_spec,
    json_to_yaml,
    openapi_json_handler,
    openapi_yaml_handler,
)
from modular_api.openapi.swagger_docs import swagger_docs_handler

__all__ = [
    "ApiRegistry",
    "Counter",
    "Gauge",
    "HealthCheck",
    "HealthCheckResult",
    "HealthResponse",
    "HealthService",
    "HealthStatus",
    "Histogram",
    "Input",
    "LogLevel",
    "MetricRegistry",
    "MetricSample",
    "MetricsRegistrar",
    "ModularApi",
    "ModularLogger",
    "ModuleBuilder",
    "Output",
    "RequestScopedLogger",
    "UseCase",
    "UseCaseDocMeta",
    "UseCaseException",
    "UseCaseRegistration",
    "api_registry",
    "build_openapi_spec",
    "cors_middleware",
    "health_handler",
    "json_to_yaml",
    "logging_middleware",
    "metrics_handler",
    "metrics_middleware",
    "openapi_json_handler",
    "openapi_yaml_handler",
    "swagger_docs_handler",
    "usecase_handler",
]
