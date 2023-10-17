import { auth } from "$lib/server/auth";
import { client } from "$lib/server/prisma";
import { signupSchema } from "$lib/validations";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { hashToken } from "$lib/server/token";
import { getConfig } from "$lib/server/config";
import { Role } from "$lib/schema";
import { env } from "$env/dynamic/private";

export const load: PageServerLoad = async ({ locals, request }) => {
	// If the user session exists, redirect authenticated users to the profile page.
	const session = await locals.validate();
	if (session) throw redirect(302, "/");

	const config = await getConfig();

	const token = new URL(request.url).searchParams.get("token");
	if (token) {
		const signup = await client.signupToken.findFirst({
			where: {
				hashedToken: hashToken(token),
				redeemed: false
			},
			select: {
				id: true,
				createdAt: true
			}
		});

		if (!signup) throw error(400, "reset token not found");

		const expiresIn = (env.TOKEN_TIME ? Number.parseInt(env.TOKEN_TIME) : 72) * 3600000;
		const expiry = signup.createdAt.getTime() + expiresIn;
		if (Date.now() < expiry) {
			return { valid: true, id: signup.id };
		}
		throw error(400, "Invite code is either invalid or already been used");
	}
	if (!config.enableSignup) {
		throw error(404, "This instance is invite only");
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = Object.fromEntries(await request.formData());
		const signupData = signupSchema.safeParse(formData);

		// check for empty values
		if (!signupData.success) {
			const errors = signupData.error.errors.map((error) => {
				return {
					field: error.path[0],
					message: error.message
				};
			});
			return fail(400, { error: true, errors });
		}

		const userCount = await client.user.count();
		let groupId: string | undefined;
		if (signupData.data.tokenId) {
			groupId = await client.signupToken
				.findUnique({
					where: {
						id: signupData.data.tokenId
					},
					select: {
						groupId: true
					}
				})
				.then((data) => data?.groupId);
		}

		try {
			const user = await auth.createUser({
				key: {
					providerId: "username",
					providerUserId: signupData.data.username,
					password: signupData.data.password
				},
				attributes: {
					username: signupData.data.username,
					email: signupData.data.email,
					name: signupData.data.name,
					roleId: userCount > 0 ? Role.USER : Role.ADMIN
				}
			});
			const session = await auth.createSession({
				userId: user.userId,
				attributes: {}
			});
			locals.setSession(session);

			if (groupId) {
				await client.userGroupMembership.create({
					data: {
						groupId: groupId,
						userId: user.userId,
						active: true
					}
				});
			}

			if (signupData.data.tokenId) {
				await client.signupToken.update({
					where: {
						id: signupData.data.tokenId
					},
					data: {
						redeemed: true
					}
				});
			}
		} catch (e) {
			return fail(400, {
				error: true,
				errors: [{ field: "username", message: "User with username or email already exists" }]
			});
		}
	}
};
