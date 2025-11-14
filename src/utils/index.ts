export const generateOrderReference = (length = 8) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "ORD-";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const getEnvVariable = (key: string): string => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Environment variable is missing: ${key}`);
    }

    return value;
};
