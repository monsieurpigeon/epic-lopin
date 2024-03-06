import { invariant } from '@epic-web/invariant'
import * as E from '@react-email/components'
import { json } from '@remix-run/node'
import {
	requireRecentVerification,
	type VerifyFunctionArgs,
} from '#app/routes/_auth+/verify.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendEmail } from '#app/utils/email.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { newEmailAddressSessionKey } from './change-email'

export async function handleVerification({
	request,
	submission,
}: VerifyFunctionArgs) {
	await requireRecentVerification(request)
	invariant(
		submission.status === 'success',
		'Submission should be successful by now',
	)

	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const newEmail = verifySession.get(newEmailAddressSessionKey)
	if (!newEmail) {
		return json(
			{
				result: submission.reply({
					formErrors: [
						'You must submit the code on the same device that requested the email change.',
					],
				}),
			},
			{ status: 400 },
		)
	}
	const preUpdateUser = await prisma.user.findFirstOrThrow({
		select: { email: true },
		where: { id: submission.value.target },
	})
	const user = await prisma.user.update({
		where: { id: submission.value.target },
		select: { id: true, email: true, username: true },
		data: { email: newEmail },
	})

	void sendEmail({
		to: preUpdateUser.email,
		subject: 'Epic Stack email changed',
		react: <EmailChangeNoticeEmail userId={user.id} />,
	})

	return redirectWithToast(
		'/settings/profile',
		{
			title: 'Email Changed',
			type: 'success',
			description: `Your email has been changed to ${user.email}`,
		},
		{
			headers: {
				'set-cookie': await verifySessionStorage.destroySession(verifySession),
			},
		},
	)
}

export function EmailChangeEmail({
	verifyUrl,
	otp,
}: {
	verifyUrl: string
	otp: string
}) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>Lopin Changement d'email</E.Text>
				</h1>
				<p>
					<E.Text>
						Voici votre code de vérification: <strong>{otp}</strong>
					</E.Text>
				</p>
				<p>
					<E.Text>Ou cliquez sur le lien:</E.Text>
				</p>
				<E.Link href={verifyUrl}>{verifyUrl}</E.Link>
			</E.Container>
		</E.Html>
	)
}

function EmailChangeNoticeEmail({ userId }: { userId: string }) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>Votre email a été mis à jour sur Lopin</E.Text>
				</h1>
				<p>
					<E.Text>
						Nous vous écrivons pour vous informer que votre email a été changé
						sur Lopin.
					</E.Text>
				</p>
				<p>
					<E.Text>
						Si vous avez changé votre adresse email, alors vous pouvez ignorer
						ce message en toute sécurité. Mais si vous n'avez pas changé votre
						adresse email, veuillez contacter le support immédiatement.
					</E.Text>
				</p>
				<p>
					<E.Text>Your Account ID: {userId}</E.Text>
				</p>
			</E.Container>
		</E.Html>
	)
}
