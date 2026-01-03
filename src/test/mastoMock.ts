type MastoMockResponse =
	| unknown
	| ((...args: unknown[]) => unknown)
	| Promise<unknown>
	| Error;

const responses = new Map<string, MastoMockResponse>();
let defaultResponse: unknown = {};

function resolveResponse(path: string, args: unknown[]) {
	const response = responses.get(path) ?? defaultResponse;
	if (response instanceof Error) {
		throw response;
	}
	if (typeof response === "function") {
		return (response as (...args: unknown[]) => unknown)(...args);
	}
	return response;
}

function createNode(path: string) {
	const fn = (...args: unknown[]) =>
		Promise.resolve(resolveResponse(path, args));

	return new Proxy(fn, {
		get: (_target, prop) => {
			if (prop === "then") return undefined;
			if (prop === Symbol.toStringTag) return "MastoMock";
			const nextPath = path ? `${path}.${String(prop)}` : String(prop);
			return createNode(nextPath);
		},
	});
}

export function createMastoMockClient() {
	return createNode("");
}

export function setMastoMockResponse(
	path: string,
	response: MastoMockResponse,
) {
	responses.set(path, response);
}

export function setMastoMockDefaultResponse(response: unknown) {
	defaultResponse = response;
}

export function resetMastoMockResponses() {
	responses.clear();
	defaultResponse = {};
}
