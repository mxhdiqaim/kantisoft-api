import db from "../db";
import {eq, or} from "drizzle-orm";
import {stores} from "../schema/stores-schema";

/**
 * Retrieves the IDs of a main store and all its branches given a store ID.
 * @param storeId The ID of a store (either main or a branch).
 * @returns A promise that resolves to an array of store IDs (main and branches).
 *          Returns null if the initial store is not found.
 */
export const getStoreAndBranchIds = async (
    storeId: string,
): Promise<string[] | null> => {
    // Find the store to determine if it's a main store or a branch
    const currentStore = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
        columns: { id: true, storeParentId: true },
    });

    if (!currentStore) {
        return null;
    }

    // Determine the main store ID
    const mainStoreId = currentStore.storeParentId || currentStore.id;

    // Get the IDs of the main store and all its branches
    const relatedStores = await db.query.stores.findMany({
        where: or(
            eq(stores.id, mainStoreId),
            eq(stores.storeParentId, mainStoreId),
        ),
        columns: { id: true },
    });

    return relatedStores.map((store) => store.id);
};
