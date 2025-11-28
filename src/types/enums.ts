export enum UserRoleEnum {
    MANAGER = "manager",
    ADMIN = "admin",
    USER = "user",
    GUEST = "guest",
}

export enum UserStatusEnum {
    ACTIVE = "active",
    INACTIVE = "inactive",
    DELETED = "deleted",
    BANNED = "banned",
}

export enum OrderStatusEnum {
    CANCELED = "canceled",
    PENDING = "pending",
    COMPLETED = "completed",
}

export enum OrderPaymentMethodEnum {
    CARD = "card",
    CASH = "cash",
    TRANSFER = "transfer",
}

export enum StatusCodeEnum {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    UNAUTHORIZED = 401,
    BAD_REQUEST = 400,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    INTERNAL_SERVER_ERROR = 500,
    UNPROCESSABLE_ENTITY = 422,
}

export enum InventoryTransactionTypeEnum {
    IN_STOCK = "inStock",
    LOW_STOCK = "lowStock",
    OUT_OF_STOCK = "outOfStock",
    // ADJUSTMENT = "adjustment",
    DISCONTINUED = "discontinued",
}
