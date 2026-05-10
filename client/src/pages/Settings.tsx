import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account-api";
import { useProfile } from "@/hooks/use-supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProfileSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, AlertTriangle, Info } from "lucide-react";
import { useState, useMemo } from "react";
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
  const { user, profile, session, signOut, adminCaptureExtrasActive, setAdminCaptureUxEnabled } = useAuth();
  const { updateProfile, isUpdating } = useProfile();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const { toast } = useToast();
  const uiLang = useAppLanguage();
  const { language, setLanguage } = useLanguage();
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const deleteConfirmKeyword = useMemo(
    () => i18n(uiLang, { en: "DELETE", fr: "SUPPRIMER" }),
    [uiLang],
  );

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
      toast({
        title: i18n(uiLang, {
          en: "Profile updated",
          fr: "Profil mis à jour",
        }),
        description: i18n(uiLang, {
          en: "Your changes have been saved.",
          fr: "Vos modifications ont été enregistrées.",
        }),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: i18n(uiLang, { en: "Error", fr: "Erreur" }),
        description: error.message,
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    if (profile?.is_subscriber) {
      toast({
        variant: "destructive",
        title: i18n(uiLang, { en: "Action required", fr: "Action requise" }),
        description: i18n(uiLang, {
          en: "Please cancel your active subscription before deleting your account.",
          fr: "Veuillez d'abord résilier votre abonnement actif avant de supprimer votre compte.",
        }),
      });
      return;
    }

    if (deleteConfirmText !== deleteConfirmKeyword) {
      toast({
        variant: "destructive",
        title: i18n(uiLang, { en: "Incorrect confirmation", fr: "Validation incorrecte" }),
        description:
          uiLang === "fr"
            ? `Veuillez saisir « ${deleteConfirmKeyword} » exactement en majuscules pour confirmer.`
            : `Type "${deleteConfirmKeyword}" exactly (uppercase) to confirm.`,
      });
      return;
    }

    try {
      setIsDeletingAccount(true);
      if (!session?.access_token) {
        throw new Error(
          i18n(uiLang, {
            en: "Session expired. Sign in again and try again.",
            fr: "Session expirée. Reconnecte-toi et réessaie.",
          }),
        );
      }
      await deleteMyAccount(session.access_token);
      toast({
        title: i18n(uiLang, { en: "Account deleted", fr: "Compte supprimé" }),
        description: i18n(uiLang, {
          en: "Your account and data have been permanently removed.",
          fr: "Votre compte et vos données ont été définitivement supprimés.",
        }),
      });
      await signOut();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : i18n(uiLang, { en: "Unknown error", fr: "Erreur inconnue" });
      toast({
        variant: "destructive",
        title: i18n(uiLang, { en: "Error", fr: "Erreur" }),
        description: message,
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {i18n(uiLang, { en: "Settings", fr: "Paramètres" })}
        </h1>
        <p className="text-zinc-300">
          {i18n(uiLang, {
            en: "Manage your account and preferences.",
            fr: "Gérez votre compte et vos préférences.",
          })}
        </p>
      </div>

      <div className="grid gap-6">
        <Card className={settingsPanelClassName}>
          <CardHeader>
            <CardTitle>
              {i18n(uiLang, {
                en: "Personal information",
                fr: "Informations personnelles",
              })}
            </CardTitle>
            <CardDescription className="text-zinc-300">
              {i18n(uiLang, {
                en: "Update your profile details.",
                fr: "Mettez à jour vos informations de profil.",
              })}
            </CardDescription>
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
                        <FormLabel>
                          {i18n(uiLang, {
                            en: "Full name",
                            fr: "Nom complet",
                          })}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={i18n(uiLang, {
                              en: "Jane Doe",
                              fr: "Jean Dupont",
                            })}
                            {...field}
                            className="h-11 border-white/15 bg-white/10 text-white placeholder:text-zinc-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>
                      {i18n(uiLang, {
                        en: "Email address",
                        fr: "Adresse email",
                      })}
                    </Label>
                    <Input value={user?.email || ""} disabled className="h-11 border-white/10 bg-white/5 text-zinc-300 disabled:opacity-100" />
                    <p className="text-xs text-zinc-400">
                      {i18n(uiLang, {
                        en: "Email cannot be changed.",
                        fr: "L’email ne peut pas être modifié.",
                      })}
                    </p>
                  </div>
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} className="shadow-sm">
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {i18n(uiLang, {
                    en: "Save changes",
                    fr: "Enregistrer les modifications",
                  })}
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
              <CardTitle>
                {i18n(uiLang, {
                  en: "Account status",
                  fr: "Statut du compte",
                })}
              </CardTitle>
              <CardDescription className="text-zinc-300">
                {i18n(uiLang, {
                  en: "See your access permissions.",
                  fr: "Consultez vos permissions d’accès.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                <Shield className="h-8 w-8 shrink-0 text-zinc-100" />
                <div>
                  <p className="font-medium text-white">
                    {i18n(uiLang, { en: "Role: administrator", fr: "Rôle : administrateur" })}
                  </p>
                  <p className="text-sm text-zinc-300">
                    {i18n(uiLang, {
                      en: "Administrative routes and tooling remain active. Capture extras are optional.",
                      fr: "Les pages et outils d’administration restent accessibles ; les aides à la capture sont optionnelles.",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-row items-start justify-between gap-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 sm:items-center sm:gap-6">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="admin-capture-ux-switch" className="text-white">
                    {i18n(uiLang, {
                      en: "Enhanced capture UX (pause, guides, overlays)",
                      fr: "Outils capture avancés (pause, overlays, clichés annotés)",
                    })}
                  </Label>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {i18n(uiLang, {
                      en: "Disable to match member experience during photo capture — no HUD, no intermediate overlays, lighter browser work.",
                      fr: "Désactivé : même expérience qu’un client pendant la série photo — sans pause intermédiaire, HUD ni encodages de debug.",
                    })}
                  </p>
                </div>
                <Switch
                  id="admin-capture-ux-switch"
                  checked={adminCaptureExtrasActive}
                  onCheckedChange={setAdminCaptureUxEnabled}
                  className="shrink-0 data-[state=checked]:bg-sky-500"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={settingsPanelClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" />
              {i18n(uiLang, { en: "Danger zone", fr: "Zone de danger" })}
            </CardTitle>
            <CardDescription className="text-zinc-300">
              {i18n(uiLang, {
                en: "Irreversible actions for your account.",
                fr: "Actions irréversibles sur votre compte.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
              <div className="space-y-2 flex-1">
                <h4 className="font-semibold text-white">
                  {i18n(uiLang, { en: "Delete account", fr: "Supprimer le compte" })}
                </h4>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {i18n(uiLang, {
                    en: "Under the GDPR, you have the right to erasure. Deleting your account will permanently remove all of your personal data from our servers.",
                    fr: "Conformément au RGPD, vous disposez d’un droit à l’effacement. La suppression de votre compte entraînera la suppression définitive de toutes vos données personnelles de nos serveurs.",
                  })}
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 p-2 text-xs text-zinc-300">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    {i18n(uiLang, {
                      en: "This action is immediate and irreversible.",
                      fr: "Cette action est immédiate et irréversible.",
                    })}
                  </span>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="shrink-0 shadow-lg shadow-destructive/20">
                    {i18n(uiLang, { en: "Delete my account", fr: "Supprimer mon compte" })}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      {i18n(uiLang, {
                        en: "Permanent deletion",
                        fr: "Suppression définitive",
                      })}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 pt-2">
                      <p className="font-medium text-foreground">
                        {i18n(uiLang, {
                          en: "Are you sure you want to delete your account?",
                          fr: "Êtes-vous sûr·e de vouloir supprimer votre compte ?",
                        })}
                      </p>
                      {profile?.is_subscriber ? (
                        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                          {i18n(uiLang, {
                            en: 'You have an active subscription. Please cancel it from the Billing tab before you can delete your account.',
                            fr: 'Vous avez un abonnement actif. Veuillez d\'abord le résilier depuis l’onglet « Facturation » avant de pouvoir supprimer votre compte.',
                          })}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {i18n(uiLang, {
                              en: "All of your data will be deleted under the GDPR. This cannot be undone.",
                              fr: "Toutes vos données seront supprimées conformément au RGPD. Cette action ne peut pas être annulée.",
                            })}
                          </p>
                          <div className="space-y-2">
                            <Label
                              htmlFor="confirm-delete"
                              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                            >
                              {uiLang === "fr"
                                ? `Saisissez « ${deleteConfirmKeyword} » pour confirmer`
                                : `Type "${deleteConfirmKeyword}" to confirm`}
                            </Label>
                            <Input
                              id="confirm-delete"
                              placeholder={deleteConfirmKeyword}
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
                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                      {i18n(uiLang, { en: "Cancel", fr: "Annuler" })}
                    </AlertDialogCancel>
                    {!profile?.is_subscriber && (
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== deleteConfirmKeyword || isDeletingAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20"
                      >
                        {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {i18n(uiLang, {
                          en: "Confirm deletion",
                          fr: "Confirmer la suppression",
                        })}
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
