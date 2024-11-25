export const badRequest = <T extends unknown>(data: T) =>
	json(data, { status: 400 });