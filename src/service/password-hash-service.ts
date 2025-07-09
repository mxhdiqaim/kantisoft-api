import bcrypt from "bcrypt";

export const passwordHashService = (password: string) => {
    const saltRounds = 10;

    return bcrypt.hashSync(password, saltRounds);
}
