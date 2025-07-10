export enum UserRoleEnum {
    ADMIN = "admin",
    CASHIER = "cashier",
    USER = "user",
    GUEST = "guest",
}

export enum UserStatusEnum {
    ACTIVE = "active",
    INACTIVE = "inactive",
    DELETED = "deleted",
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
