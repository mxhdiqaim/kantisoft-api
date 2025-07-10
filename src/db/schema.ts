import * as users from "../schema/users-schema";
import * as orders from "../schema/orders-schema";
import * as menuItems from "../schema/menu-items-schema";

import * as menuItemsRelations from "../schema/relations/menu-items-relation"
import * as ordersRelations from "../schema/relations/orders-relation"

const relations = {
    ...menuItemsRelations,
    ...ordersRelations
}

const schema = {
    ...users,
    ...orders,
    ...menuItems,

    ...relations,
};

export default schema;