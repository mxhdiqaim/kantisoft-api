import {eq} from "drizzle-orm";
import {UserRoleEnum} from "../types/enums";
import db from "../db";
import {stores} from "../schema/stores-schema";

/**
 * @desc Determines the array of store IDs a user is authorised to view data for.
 */
export const getUserStoreScope = async (
    role: UserRoleEnum,
    storeId: string,
): Promise<string[] | null> => {
    // Admin, User, Guest only sees their assigned store.
    if (
        role === UserRoleEnum.ADMIN ||
        role === UserRoleEnum.USER ||
        role === UserRoleEnum.GUEST
    ) {
        return [storeId];
    }

    // Manager sees their main store (parent) AND all branch stores (children).
    if (role === UserRoleEnum.MANAGER) {
        // Get the IDs of all branches associated with the manager's store (where managerStoreId is the parent)
        const branchStores = await db
            .select({ id: stores.id })
            .from(stores)
            .where(eq(stores.storeParentId, storeId));

        const branchIds = branchStores.map((branchStore) => branchStore.id);

        // Combine the manager's main store ID with all branch IDs.
        return [storeId, ...branchIds];
    }

    // Default case should ideally not be reached if roles are handled.
    return null;
};
