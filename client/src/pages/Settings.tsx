import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account-api";
import { useProfile } from "@/hooks/use-supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProfileSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Shield, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { i18n, useAppLanguage, useLanguage, type AppLanguage } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const settingsPanelClassName = "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

export default function Settings() {
  const { user, profile, session, signOut } = useAuth();
  const { updateProfile, isUpdating } = useProfile();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const { toast } = useToast();
  const uiLang = useAppLanguage();
  const { language, setLanguage } = useLanguage();
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const form = useForm({
    resolver: zodResolver(insertProfileSchema.pick({ full_name: true })),
    defaultValues: {
      full_name: profile?.full_name || "",
    },
  });

  const onSubmit = async (data: { full_name: string | null }) => {
    if (!user) return;
    try {
      await updateProfile({ id: user.id, updates: { full_name: data.full_name || "" } });
      toast({ title: "Profil mis à jour", description: "Vos modifications ont été enregistrées." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    if (profile?.is_subscriber) {
      toast({
        variant: "destructive",
        title: "Action requise",
        description: "Veuillez d'abord résilier votre abonnement actif avant de supprimer votre compte.",
      });
      return;
    }

    if (deleteConfirmText !== "SUPPRIMER") {
      toast({
        variant: "destructive",
        title: "Validation incorrecte",
        description: "Veuillez saisir 'SUPPRIMER' exactement en majuscules pour confirmer.",
      });
      return;
    }

    try {
      setIsDeletingAccount(true);
      if (!session?.access_token) {
        throw new Error("Session expirée. Reconnecte-toi et réessaie.");
      }
      await deleteMyAccount(session.access_token);
      toast({
        title: "Compte supprimé",
        description: "Votre compte et vos données ont été définitivement supprimés.",
      });
      await signOut();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur", description: message });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Paramètres</h1>
        <p className="text-zinc-300">Gérez votre compte et vos préférences.</p>
      </div>

      <div className="grid gap-6">
        <Card className={settingsPanelClassName}>
          <CardHeader>
            <CardTitle>Informations Personnelles</CardTitle>
            <CardDescription className="text-zinc-300">Mettez à jour vos informations de profil.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom Complet</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean Dupont" {...field} className="h-11 border-white/15 bg-white/10 text-white placeholder:text-zinc-500" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>Adresse Email</Label>
                    <Input value={user?.email || ""} disabled className="h-11 border-white/10 bg-white/5 text-zinc-300 disabled:opacity-100" />
                    <p className="text-xs text-zinc-400">L'email ne peut pas être modifié.</p>
                  </div>
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} className="shadow-sm">
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer les modifications
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className={settingsPanelClassName}>
          <CardHeader>
            <CardTitle>
              {i18n(uiLang, { en: "Language", fr: "Langue" })}
            </CardTitle>
            <CardDescription className="text-zinc-300">
              {i18n(uiLang, {
                en: "Interface language for ScoreMax (saved on this device).",
                fr: "Langue de l’interface ScoreMax (enregistrée sur cet appareil).",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-zinc-200">
              {i18n(uiLang, { en: "Display language", fr: "Langue d’affichage" })}
            </Label>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as AppLanguage)}
            >
              <SelectTrigger className="h-11 border-white/15 bg-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {profile?.role === "admin" && (
          <Card className={settingsPanelClassName}>
            <CardHeader>
              <CardTitle>Statut du Compte</CardTitle>
              <CardDescription className="text-zinc-300">Consultez vos permissions d'accès.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                <Shield className="h-8 w-8 text-zinc-100" />
                <div>
                  <p className="font-medium text-white">Rôle : Administrateur</p>
                  <p className="text-sm text-zinc-300">
                    Vous avez un accès administratif complet à la plateforme.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={settingsPanelClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Zone de Danger
            </CardTitle>
            <CardDescription className="text-zinc-300">Actions irréversibles sur votre compte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
              <div className="space-y-2 flex-1">
                <h4 className="font-semibold text-white">Supprimer le compte</h4>
                <p className="text-sm leading-relaxed text-zinc-300">
                  Conformément au <strong>RGPD</strong>, vous disposez d'un droit à l'effacement. La suppression de votre compte entraînera la suppression définitive de toutes vos données personnelles de nos serveurs.
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 p-2 text-xs text-zinc-300">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>Cette action est immédiate et irréversible.</span>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="shrink-0 shadow-lg shadow-destructive/20">
                    Supprimer mon compte
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Suppression définitive
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 pt-2">
                      <p className="font-medium text-foreground">
                        Êtes-vous sûr de vouloir supprimer votre compte ?
                      </p>
                      {profile?.is_subscriber ? (
                        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                          Vous avez un abonnement actif. Veuillez d'abord le résilier depuis l'onglet "Facturation" avant de pouvoir supprimer votre compte.
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Toutes vos données seront supprimées conformément au RGPD. Cette action ne peut pas être annulée.
                          </p>
                          <div className="space-y-2">
                            <Label htmlFor="confirm-delete" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Saisissez "SUPPRIMER" pour confirmer
                            </Label>
                            <Input 
                              id="confirm-delete"
                              placeholder="SUPPRIMER" 
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              className="border-destructive/30 focus-visible:ring-destructive"
                            />
                          </div>
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Annuler</AlertDialogCancel>
                    {!profile?.is_subscriber && (
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "SUPPRIMER" || isDeletingAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20"
                      >
                        {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmer la suppression
                      </AlertDialogAction>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
