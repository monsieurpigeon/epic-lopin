import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Link } from '@remix-run/react'
import { Button } from '../../../components/ui/button'
import { prisma } from '../../../utils/db.server'
import { useOptionalUser } from '../../../utils/user'

export const meta: MetaFunction = () => [{ title: 'Lopin' }]

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			name: true,
			username: true,
			createdAt: true,
			image: { select: { id: true } },
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })

	return json({ user, userJoinedDisplay: user.createdAt.toLocaleDateString() })
}

export default function Index() {
	const user = useOptionalUser()
	const isLoggedInUser = user?.id

	return (
		<main className="font-poppins grid h-full place-items-center">
			<div className="grid place-items-center px-4 py-16 xl:grid-cols-2 xl:gap-24">
				<div className="flex max-w-md flex-col items-center text-center xl:order-2 xl:items-start xl:text-left">
					<h1
						data-heading
						className="mt-8 animate-slide-top text-4xl font-medium text-foreground [animation-delay:0.3s] [animation-fill-mode:backwards] md:text-5xl xl:mt-4 xl:animate-slide-left xl:text-6xl xl:[animation-delay:0.2s] xl:[animation-fill-mode:backwards]"
					>
						Lopin
					</h1>
					<p
						data-paragraph
						className="mt-6 animate-slide-top text-xl/7 text-muted-foreground [animation-fill-mode:backwards] [animation-delay:0.4s] xl:mt-8 xl:animate-slide-left xl:text-xl/6 xl:leading-10 xl:[animation-fill-mode:backwards] xl:[animation-delay:0.5s]"
					>
						Un site web pour ma ferme, en 10 minutes chrono
					</p>

					<div className="mt-10 flex gap-4">
						{isLoggedInUser && (
							<Button
								asChild
								className="animate-slide-top [animation-fill-mode:backwards] [animation-delay:0.8s] xl:animate-slide-left xl:[animation-fill-mode:backwards] xl:[animation-delay:1s]"
							>
								<Link to="settings/farm" prefetch="intent">
									Créer mon site
								</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</main>
	)
}
