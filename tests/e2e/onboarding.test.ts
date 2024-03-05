import { invariant } from '@epic-web/invariant'
import { faker } from '@faker-js/faker'
import { prisma } from '#app/utils/db.server.ts'
import { readEmail } from '#tests/mocks/utils.ts'
import { test as base, createUser, expect } from '#tests/playwright-utils.ts'

const URL_REGEX = /(?<url>https?:\/\/[^\s$.?#].[^\s]*)/
const CODE_REGEX = /Voici votre code de vérification: (?<code>[\d\w]+)/
function extractUrl(text: string) {
	const match = text.match(URL_REGEX)
	return match?.groups?.url
}

const test = base.extend<{
	getOnboardingData(): {
		username: string
		name: string
		email: string
		password: string
	}
}>({
	getOnboardingData: async ({}, use) => {
		const userData = createUser()
		await use(() => {
			const onboardingData = {
				...userData,
				password: faker.internet.password(),
			}
			return onboardingData
		})
		await prisma.user.deleteMany({ where: { username: userData.username } })
	},
})

test('onboarding with link', async ({ page, getOnboardingData }) => {
	const onboardingData = getOnboardingData()

	await page.goto('/')

	await page.getByRole('link', { name: /connexion/i }).click()
	await expect(page).toHaveURL(`/login`)

	const createAccountLink = page.getByRole('link', {
		name: /créer un compte/i,
	})
	await createAccountLink.click()

	await expect(page).toHaveURL(`/signup`)

	const emailTextbox = page.getByRole('textbox', { name: /e-mail/i })
	await emailTextbox.click()
	await emailTextbox.fill(onboardingData.email)

	await page.getByRole('button', { name: /continuer/i }).click()
	await expect(
		page.getByRole('button', { name: /continuer/i, disabled: true }),
	).toBeVisible()
	await expect(page.getByText(/vérifiez vos emails/i)).toBeVisible()

	const email = await readEmail(onboardingData.email)
	invariant(email, 'Email not found')
	expect(email.to).toBe(onboardingData.email.toLowerCase())
	expect(email.from).toBe('contact@lopin.app')
	expect(email.subject).toMatch(/bienvenue/i)
	const onboardingUrl = extractUrl(email.text)
	invariant(onboardingUrl, 'Onboarding URL not found')
	await page.goto(onboardingUrl)

	await expect(page).toHaveURL(/\/verify/)

	await page
		.getByRole('main')
		.getByRole('button', { name: /continuer/i })
		.click()

	await expect(page).toHaveURL(`/onboarding`)
	await page
		.getByRole('textbox', { name: /^identifiant/i })
		.fill(onboardingData.username)

	await page.getByRole('textbox', { name: /^nom/i }).fill(onboardingData.name)

	await page.getByLabel(/^mot de passe/i).fill(onboardingData.password)

	await page
		.getByLabel(/^confirmer le mot de passe/i)
		.fill(onboardingData.password)

	await page.getByLabel(/politique/i).check()

	await page.getByLabel(/souvenir de moi/i).check()

	await page.getByRole('button', { name: /créer un compte/i }).click()

	await expect(page).toHaveURL(`/`)

	await page.getByRole('link', { name: onboardingData.name }).click()
	await page.getByRole('menuitem', { name: /profil/i }).click()

	await expect(page).toHaveURL(`/users/${onboardingData.username}`)

	await page.getByRole('link', { name: onboardingData.name }).click()
	await page.getByRole('menuitem', { name: /déconnexion/i }).click()
	await expect(page).toHaveURL(`/`)
})

test('onboarding with a short code', async ({ page, getOnboardingData }) => {
	const onboardingData = getOnboardingData()

	await page.goto('/signup')

	const emailTextbox = page.getByRole('textbox', { name: /e-mail/i })
	await emailTextbox.click()
	await emailTextbox.fill(onboardingData.email)

	await page.getByRole('button', { name: /continuer/i }).click()
	await expect(
		page.getByRole('button', { name: /continuer/i, disabled: true }),
	).toBeVisible()
	await expect(page.getByText(/vérifiez vos emails/i)).toBeVisible()

	const email = await readEmail(onboardingData.email)
	invariant(email, 'Email not found')
	expect(email.to).toBe(onboardingData.email.toLowerCase())
	expect(email.from).toBe('contact@lopin.app')
	expect(email.subject).toMatch(/bienvenue/i)
	const codeMatch = email.text.match(CODE_REGEX)
	const code = codeMatch?.groups?.code
	invariant(code, 'Onboarding code not found')
	await page.getByRole('textbox', { name: /code/i }).fill(code)
	await page.getByRole('button', { name: /continuer/i }).click()

	await expect(page).toHaveURL(`/onboarding`)
})

test('login as existing user', async ({ page, insertNewUser }) => {
	const password = faker.internet.password()
	const user = await insertNewUser({ password })
	invariant(user.name, 'User name not found')
	await page.goto('/login')
	await page.getByRole('textbox', { name: /e-mail/i }).fill(user.username)
	await page.getByLabel(/^mot de passe$/i).fill(password)
	await page.getByRole('button', { name: /connexion/i }).click()
	await expect(page).toHaveURL(`/`)

	await expect(page.getByRole('link', { name: user.name })).toBeVisible()
})

test('reset password with a link', async ({ page, insertNewUser }) => {
	const originalPassword = faker.internet.password()
	const user = await insertNewUser({ password: originalPassword })
	invariant(user.name, 'User name not found')
	await page.goto('/login')

	await page.getByRole('link', { name: /mot de passe oublié/i }).click()
	await expect(page).toHaveURL('/forgot-password')

	await expect(
		page.getByRole('heading', { name: /oubli du mot de passe/i }),
	).toBeVisible()
	await page.getByRole('textbox', { name: /username/i }).fill(user.username)
	await page.getByRole('button', { name: /récupérer le mot de passe/i }).click()
	await expect(
		page.getByRole('button', {
			name: /récupérer le mot de passe/i,
			disabled: true,
		}),
	).toBeVisible()
	await expect(page.getByText(/vérifiez vos emails/i)).toBeVisible()

	const email = await readEmail(user.email)
	invariant(email, 'Email not found')
	expect(email.subject).toMatch(/remise à zéro de votre mot de passe/i)
	expect(email.to).toBe(user.email.toLowerCase())
	expect(email.from).toBe('contact@lopin.app')
	const resetPasswordUrl = extractUrl(email.text)
	invariant(resetPasswordUrl, 'Reset password URL not found')
	await page.goto(resetPasswordUrl)

	await expect(page).toHaveURL(/\/verify/)

	await page
		.getByRole('main')
		.getByRole('button', { name: /continuer/i })
		.click()

	await expect(page).toHaveURL(`/reset-password`)
	const newPassword = faker.internet.password()
	await page.getByLabel(/^nouveau mot de passe$/i).fill(newPassword)
	await page.getByLabel(/^confirmer le mot de passe$/i).fill(newPassword)

	await page
		.getByRole('button', { name: /réinitialiser le mot de passe/i })
		.click()
	await expect(
		page.getByRole('button', {
			name: /réinitialiser le mot de passe/i,
			disabled: true,
		}),
	).toBeVisible()

	await expect(page).toHaveURL('/login')
	await page.getByRole('textbox', { name: /e-mail/i }).fill(user.username)
	await page.getByLabel(/^mot de passe$/i).fill(originalPassword)
	await page.getByRole('button', { name: /connexion/i }).click()

	await expect(page.getByText(/invalid username or password/i)).toBeVisible()

	await page.getByLabel(/^mot de passe$/i).fill(newPassword)
	await page.getByRole('button', { name: /connexion/i }).click()

	await expect(page).toHaveURL(`/`)

	await expect(page.getByRole('link', { name: user.name })).toBeVisible()
})

test('reset password with a short code', async ({ page, insertNewUser }) => {
	const user = await insertNewUser()
	await page.goto('/login')

	await page.getByRole('link', { name: /mot de passe oublié/i }).click()
	await expect(page).toHaveURL('/forgot-password')

	await expect(
		page.getByRole('heading', { name: /oubli du mot de passe/i }),
	).toBeVisible()
	await page.getByRole('textbox', { name: /username/i }).fill(user.username)
	await page.getByRole('button', { name: /récupérer le mot de passe/i }).click()
	await expect(
		page.getByRole('button', {
			name: /récupérer le mot de passe/i,
			disabled: true,
		}),
	).toBeVisible()
	await expect(page.getByText(/vérifiez vos emails/i)).toBeVisible()

	const email = await readEmail(user.email)
	invariant(email, 'Email not found')
	expect(email.subject).toMatch(/remise à zéro de votre mot de passe/i)
	expect(email.to).toBe(user.email)
	expect(email.from).toBe('contact@lopin.app')
	const codeMatch = email.text.match(CODE_REGEX)
	const code = codeMatch?.groups?.code
	invariant(code, 'Reset Password code not found')
	await page.getByRole('textbox', { name: /code/i }).fill(code)
	await page.getByRole('button', { name: /continuer/i }).click()

	await expect(page).toHaveURL(`/reset-password`)
})
