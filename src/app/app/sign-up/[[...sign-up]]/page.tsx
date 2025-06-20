import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join to access the San Francisco Sea Level Rise visualization tool
          </p>
        </div>
        <div className="mt-8">
          <SignUp
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-lg border border-gray-200 rounded-lg",
              },
            }}
            redirectUrl="/"
            signInUrl="/app/sign-in"
          />
        </div>
      </div>
    </div>
  );
}
