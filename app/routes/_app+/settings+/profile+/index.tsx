import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getUserImgSrc } from '#app/utils/misc.tsx'
import { NameSchema, UsernameSchema } from '#app/utils/user-validation.ts'
import { twoFAVerificationType } from './two-factor.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const ProfileFormSchema = z.object({
	name: NameSchema.optional(),
	username: UsernameSchema,
})

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			username: true,
			email: true,
			image: {
				select: { id: true },
			},
			_count: {
				select: {
					sessions: {
						where: {
							expirationDate: { gt: new Date() },
						},
					},
				},
			},
		},
	})

	const twoFactorVerification = await prisma.verification.findUnique({
		select: { id: true },
		where: { target_type: { type: twoFAVerificationType, target: userId } },
	})

	const password = await prisma.password.findUnique({
		select: { userId: true },
		where: { userId },
	})

	return json({
		user,
		hasPassword: Boolean(password),
		isTwoFactorEnabled: Boolean(twoFactorVerification),
	})
}

type ProfileActionArgs = {
	request: Request
	userId: string
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	return profileUpdateAction({ request, userId, formData })
}

export default function EditUserProfile() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="flex flex-col gap-12">
			<div className="flex justify-center">
				<div className="relative h-52 w-52">
					<img
						src={getUserImgSrc(data.user.image?.id)}
						alt={data.user.username}
						className="h-full w-full rounded-full object-cover"
					/>
					<Button
						asChild
						variant="outline"
						className="absolute -right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full p-0"
					>
						<Link
							preventScrollReset
							to="photo"
							title="Change profile photo"
							aria-label="Change profile photo"
						>
							<Icon name="camera" className="h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>
			<UpdateProfile />
		</div>
	)
}

async function profileUpdateAction({ userId, formData }: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		async: true,
		schema: ProfileFormSchema.superRefine(async ({ username }, ctx) => {
			const existingUsername = await prisma.user.findUnique({
				where: { username },
				select: { id: true },
			})
			if (existingUsername && existingUsername.id !== userId) {
				ctx.addIssue({
					path: ['username'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this username',
				})
			}
		}),
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value

	await prisma.user.update({
		select: { username: true },
		where: { id: userId },
		data: {
			name: data.name,
			username: data.username,
		},
	})

	return json({
		result: submission.reply(),
	})
}

function UpdateProfile() {
	const data = useLoaderData<typeof loader>()

	const fetcher = useFetcher<typeof profileUpdateAction>()

	const [form, fields] = useForm({
		id: 'edit-profile',
		constraint: getZodConstraint(ProfileFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ProfileFormSchema })
		},
		defaultValue: {
			username: data.user.username,
			name: data.user.name,
		},
	})

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<div className="grid grid-cols-6 gap-x-10">
				<Field
					className="col-span-3"
					labelProps={{
						htmlFor: fields.username.id,
						children: 'Username',
					}}
					inputProps={getInputProps(fields.username, { type: 'text' })}
					errors={fields.username.errors}
				/>
				<Field
					className="col-span-3"
					labelProps={{ htmlFor: fields.name.id, children: 'Name' }}
					inputProps={getInputProps(fields.name, { type: 'text' })}
					errors={fields.name.errors}
				/>
			</div>

			<ErrorList errors={form.errors} id={form.errorId} />

			<div className="mt-8 flex justify-center">
				<StatusButton
					type="submit"
					size="wide"
					status={fetcher.state !== 'idle' ? 'pending' : form.status ?? 'idle'}
				>
					Save changes
				</StatusButton>
			</div>
		</fetcher.Form>
	)
}
