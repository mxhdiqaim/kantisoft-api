import * as users from "../schema/users-schema";
import * as orders from "../schema/orders-schema";
import * as menuItems from "../schema/menu-items-schema";

import * as menuItemsRelations from "../schema/relations/menu-items-relation";
import * as ordersRelations from "../schema/relations/orders-relation";
import * as usersRelations from "../schema/relations/user-relations";

const relations = {
    ...menuItemsRelations,
    ...ordersRelations,
    ...usersRelations,
};

const schema = {
    ...users,
    ...orders,
    ...menuItems,

    ...relations,
};

export default schema;
