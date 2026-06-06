from api_service.schemas import Permission, Resource


def route_metadata(resource: Resource, permission: Permission) -> dict:
    return {"x-resource": resource.value, "x-permission": permission.value}
