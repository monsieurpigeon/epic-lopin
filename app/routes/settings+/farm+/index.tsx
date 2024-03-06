import {
	getFormProps,
	getInputProps,
	getTextareaProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, Field, TextareaField } from '#app/components/forms.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export const FarmFormSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
})

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)

	const farm = await prisma.farm.findFirst({
		where: { userId },
		select: { id: true, name: true, description: true },
	})

	return json({
		farm,
	})
}

type FarmActionArgs = {
	request: Request
	userId: string
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	return farmUpdateAction({ request, userId, formData })
}

export default function EditUserFarm() {
	return (
		<div className="flex flex-col gap-12">
			<UpdateFarm />
		</div>
	)
}

async function farmUpdateAction({ userId, formData }: FarmActionArgs) {
	const submission = await parseWithZod(formData, {
		async: true,
		schema: FarmFormSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value

	await prisma.farm.upsert({
		create: {
			id: data.id,
			userId,
			name: data.name,
			description: data.description,
		},
		update: {
			id: data.id,
			userId,
			name: data.name,
			description: data.description,
		},
		where: { userId },
	})

	return json({
		result: submission.reply(),
	})
}

function UpdateFarm() {
	const data = useLoaderData<typeof loader>()

	const fetcher = useFetcher<typeof farmUpdateAction>()

	const [form, fields] = useForm({
		id: 'edit-farm',
		constraint: getZodConstraint(FarmFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: FarmFormSchema })
		},
		defaultValue: {
			id: data.farm?.id,
			name: data.farm?.name,
			description: data.farm?.description,
		},
	})

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<div>
				<Field
					labelProps={{ children: 'Nom de ma ferme' }}
					inputProps={{
						autoFocus: true,
						...getInputProps(fields.name, { type: 'text' }),
					}}
					errors={fields.name.errors}
				/>
				<Field
					labelProps={{ children: 'URL' }}
					inputProps={{
						autoFocus: true,
						...getInputProps(fields.id, { type: 'text' }),
					}}
					errors={fields.id.errors}
				/>
				<TextareaField
					labelProps={{ children: 'Description' }}
					textareaProps={{
						...getTextareaProps(fields.description),
					}}
					errors={fields.description.errors}
				/>
			</div>

			<ErrorList errors={form.errors} id={form.errorId} />

			<div className="mt-8 flex justify-center">
				<StatusButton
					type="submit"
					size="wide"
					status={fetcher.state !== 'idle' ? 'pending' : form.status ?? 'idle'}
				>
					Enregistrer
				</StatusButton>
			</div>
		</fetcher.Form>
	)
}
