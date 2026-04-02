export interface AuthHeader {
	name: string;
	value: string;
}

export interface AuthProvider {
	getAuth(service: string): AuthHeader;
}
