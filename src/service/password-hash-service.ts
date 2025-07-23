import bcrypt from "bcrypt";

const saltRounds = 10 as const;

/**
 * Hashes a plaintext password.
 * @param password The plaintext password to hash.
 * @returns A promise that resolves to the hashed password.
 */
export const hash = (password: string) => {
    return bcrypt.hashSync(password, saltRounds);
};

/**
 * Compares a plaintext password with a hash.
 * @param password The plaintext password.
 * @param hash The hash to compare against.
 * @returns A promise that resolves to true if the password matches the hash, otherwise false.
 */
const compare = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

export const passwordHashService = {
    hash,
    compare,
};
