import * as users from "../schema/users-schema";
import * as orders from "../schema/orders-schema";
import * as menuItems from "../schema/menu-items-schema";
import * as stores from "../schema/stores-schema";
import * as activityLog from "../schema/activity-log-schema";
import * as inventory from "../schema/inventory-schema";
import * as inventoryTransactions from "../schema/inventory-schema/inventory-transaction-schema";
import * as rawMaterials from "../schema/raw-materials-schema";
import * as rawMaterialInventory from "../schema/raw-materials-schema/raw-material-inventory-schema";
import * as billOfMaterials from "../schema/bill-of-materials-schema";
import * as unitOfMeasurement from "../schema/unit-of-measurement-schema";

import * as menuItemsRelations from "../schema/relations/menu-items-relation";
import * as ordersRelations from "../schema/relations/orders-relation";
import * as usersRelations from "../schema/relations/user-relations";
import * as storeRelations from "../schema/relations/store-relation";
import * as inventoryRelations from "../schema/relations/inventory-relations";
import * as unitOfMeasurementRelations from "../schema/relations/unit-of-measurement-relation";
import * as rawMaterialsRelations from "../schema/relations/raw-material-relation";
import * as rawMaterialInventoryRelations from "../schema/relations/raw-material-inventory-relation";
import * as billOfMaterialsRelations from "../schema/relations/bill-of-material-relation";

const relations = {
    ...menuItemsRelations,
    ...ordersRelations,
    ...usersRelations,
    ...storeRelations,
    ...inventoryRelations,
    ...unitOfMeasurementRelations,
    ...rawMaterialsRelations,
    ...rawMaterialInventoryRelations,
    ...billOfMaterialsRelations,
};

const schema = {
    ...users,
    ...orders,
    ...menuItems,
    ...stores,
    ...activityLog,
    ...inventory,
    ...inventoryTransactions,
    ...rawMaterials,
    ...rawMaterialInventory,
    ...billOfMaterials,
    ...unitOfMeasurement,

    ...relations,
};

export default schema;
