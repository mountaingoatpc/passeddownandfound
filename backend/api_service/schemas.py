from enum import Enum


class Resource(str, Enum):
    HEALTH = "health"
    AUTH = "auth"
    USER = "user"
    INVENTORY = "inventory"


class Permission(str, Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
