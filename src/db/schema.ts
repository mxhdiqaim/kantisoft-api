import * as users from "../schema/users-schema";
import * as orders from "../schema/orders-schema";
import * as menuItems from "../schema/menu-items-schema";
import * as stores from "../schema/stores-schema";
import * as activityLog from "../schema/activity-log-schema";
import * as inventory from "../schema/inventory-schema";
import * as inventoryTransactions from "../schema/inventory-schema/inventory-transaction-schema";

import * as menuItemsRelations from "../schema/relations/menu-items-relation";
import * as ordersRelations from "../schema/relations/orders-relation";
import * as usersRelations from "../schema/relations/user-relations";
import * as storeRelations from "../schema/relations/store-relation";
import * as inventoryRelations from "../schema/relations/inventory-relations";

const relations = {
    ...menuItemsRelations,
    ...ordersRelations,
    ...usersRelations,
    ...storeRelations,
    ...inventoryRelations,
};

const schema = {
    ...users,
    ...orders,
    ...menuItems,
    ...stores,
    ...activityLog,
    ...inventory,
    ...inventoryTransactions,

    ...relations,
};

export default schema;
