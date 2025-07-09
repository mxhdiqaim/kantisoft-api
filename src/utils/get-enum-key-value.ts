type GetEnumKeyValuesReturnT = { key: string; value: string }[];

/**
 * @description  Takes an enum and gets the object - key, value pair

 * @example
 *
 * input
 * enum ExampleEnum {
 *  ACTIVE, INACTIVE, CLOSED
 * }
 *
 * function call
 * getEnumKeyValues(ExampleEnum)
 *
 * output
 * [
 *  { key: "active", value: "0" },
 *  { key: "closed", value: "1" }
 * ]
 */
export const getEnumKeyValues = <T extends object>(enumObj: T): GetEnumKeyValuesReturnT => {
    return Object.entries(enumObj)
        .filter(([key]) => isNaN(Number(key))) // Filter out the reverse-mapped numeric keys
        .map(([key, value]) => ({
            key: key.replace(/_/g, " ").toLowerCase(), // Replace underscores and lowercase the key
            value: String(value), // Cast the value as a number
        }));
}

/**
 * @description Returns Stringifies enum values meant for pgEnum
 *
 *  * @example
 * input
 * enum ExampleEnum {
 *  ACTIVE, INACTIVE, CLOSED
 * }
 *
 * function call
 * getEnumValues(ExampleEnum)
 *
 * output
 * [ "0", "1", "2" ]
 */
export const getEnumValues = <T extends object>(enumObj: T): [string, ...string[]] => {
    const keyValues = getEnumKeyValues(enumObj);
    const values = keyValues.map((e) => e.value);

    return values as [string, ...string[]];
}