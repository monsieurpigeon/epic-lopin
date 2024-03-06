import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { prisma } from '../../../../utils/db.server'

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: data?.farm.name },
		{
			name: 'description',
			content: data?.farm.description,
		},
		{
			property: 'og:title',
			content: data?.farm.name,
		},
		{
			property: 'og:description',
			content: data?.farm.description,
		},
	]
}

export async function loader({ params }: LoaderFunctionArgs) {
	const farm = await prisma.farm.findUnique({
		where: { id: params.farmname },
		select: {
			id: true,
			name: true,
			description: true,
		},
	})
	invariantResponse(farm, 'Not found', { status: 404 })

	return json({
		farm,
	})
}

export default function FarmRoute() {
	const data = useLoaderData<typeof loader>()
	return (
		<div>
			<pre>{JSON.stringify(data, null, 4)}</pre>
		</div>
	)
}
