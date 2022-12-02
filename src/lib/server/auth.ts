import lucia from "lucia-auth";
import prisma from "@lucia-auth/adapter-prisma";
import { dev } from "$app/environment";
import { client } from "./prisma";

export const auth = lucia({
	adapter: prisma(client),
	env: dev ? "DEV" : "PROD",
	transformUserData: (userData) => {
		return {
			userId: userData.id,
			username: userData.username,
			firstname: userData.firstname,
			lastname: userData.lastname,
			roleId: userData.roleId
		};
	}
});

export type Auth = typeof auth;
