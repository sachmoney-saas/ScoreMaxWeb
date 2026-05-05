import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";

export function TermsGuard() {
  const { profile, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && profile && !profile.has_accepted_terms) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [profile, isLoading]);

  const handleAccept = async () => {
    try {
      if (!user?.id) {
        console.error("No user ID available for terms acceptance");
        return;
      }
      
      console.log("Updating terms acceptance for user:", user.id);
      
      const { error } = await supabase
        .from("profiles")
        .update({ has_accepted_terms: true })
        .eq("id", user.id);

      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }
      
      toast({
        title: "Merci !",
        description: "Vous pouvez maintenant accéder à l'application.",
      });
      setIsOpen(false);
      
      // Invalider le cache pour forcer useAuth à recharger le profil
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (error: any) {
      console.error("Final error in handleAccept:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour vos préférences.",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 text-foreground">
      <div className="bg-card border shadow-lg max-w-lg w-full p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-bold">Acceptation requise</h2>
        <p className="text-muted-foreground text-sm">
          Pour continuer à utiliser notre service, vous devez accepter nos{" "}
          <Link href="/terms" className="text-primary hover:underline">Conditions Générales d'Utilisation</Link>{" "}
          et notre{" "}
          <Link href="/privacy" className="text-primary hover:underline">Politique de Confidentialité</Link>.
        </p>
        <div className="flex justify-end pt-2">
          <button 
            onClick={handleAccept}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            J'accepte et je continue
          </button>
        </div>
      </div>
    </div>
  );
}
