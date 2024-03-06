import { Outlet } from '@remix-run/react'

export default function FarmLayout() {
	return (
		<div className="m-auto mb-24 mt-16 max-w-3xl">
			<main className="mx-auto bg-muted px-6 py-8 md:container md:rounded-3xl">
				<Outlet />
			</main>
		</div>
	)
}
