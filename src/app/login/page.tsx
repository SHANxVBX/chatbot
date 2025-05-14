import { CreatorLoginForm } from "@/components/auth/CreatorLoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-2xl glassmorphic">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Creator Access</CardTitle>
          <CardDescription className="text-muted-foreground">
            Log in to manage AI provider settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatorLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
