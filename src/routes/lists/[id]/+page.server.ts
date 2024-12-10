import { client } from "$lib/server/prisma";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getConfig } from "$lib/server/config";
import { createFilter, createSorts } from "$lib/server/sort-filter-util";
import { getFormatter } from "$lib/i18n";

export const load = (async ({ params, url }) => {
    const $t = await getFormatter();
    const list = await client.list.findUnique({
        select: {
            name: true,
            owner: {
                select: {
                    name: true
                }
            },
            groupId: true,
            public: true
        },
        where: {
            id: params.id
        }
    });
    if (!list) {
        error(404, $t("errors.public-list-not-found"));
    }

    const config = await getConfig(list.groupId);
    if (list.public && config.listMode !== "registry") {
        error(404, $t("errors.public-list-not-found"));
    }

    const filter = createFilter(url.searchParams.get("filter"));
    filter.lists = {
        every: {
            id: params.id
        }
    };

    const sort = url.searchParams.get("sort");
    const direction = url.searchParams.get("dir");
    const orderBy = createSorts(sort, direction);

    const items = await client.item.findMany({
        where: filter,
        orderBy: orderBy,
        include: {
            addedBy: {
                select: {
                    username: true,
                    name: true
                }
            },
            pledgedBy: {
                select: {
                    username: true,
                    name: true
                }
            },
            publicPledgedBy: {
                select: {
                    username: true,
                    name: true
                }
            },
            user: {
                select: {
                    username: true,
                    name: true
                }
            },
            itemPrice: true
        }
    });

    if (sort === "price" && direction === "asc") {
        // need to re-sort when descending since Prisma can't order with nulls last
        items.sort((a, b) => (a.itemPrice?.value ?? Infinity) - (b.itemPrice?.value ?? Infinity));
    }

    return {
        list: {
            ...list,
            items
        }
    };
}) satisfies PageServerLoad;
