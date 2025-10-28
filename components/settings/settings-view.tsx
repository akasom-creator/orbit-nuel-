"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Building,
  Bell,
  Shield,
  CreditCard,
  Users,
  Key,
  Camera,
  Save,
  Trash2,
  Loader2,
} from "lucide-react";
import { useNotificationStore } from "@/lib/stores/notification-store";
import { useUpdateProfile } from "@/lib/queries/users";
import { useSettings, useUpdateSettings } from "@/lib/queries/settings";
import { showToast } from "@/lib/toast";

export function SettingsView() {
  const updateProfileMutation = useUpdateProfile();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    desktop: false,
    marketing: false,
  });

  const [company, setCompany] = useState({
    name: "TechStart Africa",
    website: "https://techstart.africa",
    industry: "Technology",
    size: "11-50 employees",
    description: "Leading technology company focused on digital transformation for African businesses.",
  });

  const [security, setSecurity] = useState({
    twoFactorEnabled: false,
    allowTeamInvites: true,
    requireAdminApproval: false,
    allowExternalSharing: true,
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setNotifications({
        email: settings.emailNotifications,
        push: settings.pushNotifications,
        desktop: settings.desktopNotifications,
        marketing: settings.marketingCommunications,
      });
      setCompany({
        name: "TechStart Africa", // Keep existing logic for company name
        website: settings.companyWebsite || "",
        industry: settings.companyIndustry || "Technology",
        size: settings.companySize || "11-50 employees",
        description: settings.companyDescription || "",
      });
      setSecurity({
        twoFactorEnabled: settings.twoFactorEnabled,
        allowTeamInvites: settings.allowTeamInvites,
        requireAdminApproval: settings.requireAdminApproval,
        allowExternalSharing: settings.allowExternalSharing,
      });
      setProfile(prev => ({
        ...prev,
        bio: settings.bio || prev.bio,
        location: settings.location || prev.location,
      }));
    }
  }, [settings]);

  const [profile, setProfile] = useState({
    name: "Sarah Johnson",
    email: "sarah@techstart.africa",
    phone: "+234 801 234 5678",
    location: "Lagos, Nigeria",
    bio: "CEO and Founder of TechStart Africa. Passionate about building innovative solutions for African businesses.",
    avatar: "/professional-woman-ceo.png",
  });

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        showToast.error("Please select an image file");
        return;
      }

      // Validate file size (1MB max)
      if (file.size > 1024 * 1024) {
        showToast.error("File size must be less than 1MB");
        return;
      }

      try {
        // Upload avatar to server
        const formData = new FormData();
        formData.append("avatar", file);

        const token = localStorage.getItem("authToken");
        const response = await fetch(
          "http://localhost:3001/files/upload/avatar",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to upload avatar");
        }

        const result = await response.json();
        setProfile({ ...profile, avatar: result.avatarUrl });
        showToast.success("Avatar updated successfully");
      } catch (error) {
        console.error("Avatar upload failed:", error);
        showToast.error("Failed to upload avatar");
      }
    }
  };


  return (
    <div className="space-y-6" data-dashboard>
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted mt-1">
          Manage your account and workspace preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 animate-slide-up stagger-1">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center space-x-2">
            <Building className="w-4 h-4" />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex items-center space-x-2"
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center space-x-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage
                    src={profile.avatar || "/placeholder.svg"}
                    alt={profile.name}
                  />
                  <AvatarFallback className="text-lg">
                    {profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("avatar-upload")?.click()
                      }
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Change Photo
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    JPG, GIF or PNG. 1MB max.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={profile.location}
                    onChange={(e) =>
                      setProfile({ ...profile, location: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={profile.bio}
                  onChange={(e) =>
                    setProfile({ ...profile, bio: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={async () => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        bio: profile.bio,
                        location: profile.location,
                      });
                      showToast.success("Profile updated successfully");
                    } catch (error) {
                      console.error("Profile update failed:", error);
                      showToast.error("Failed to update profile");
                    }
                  }}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Settings */}
        <TabsContent value="company" className="space-y-6">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Manage your company details and workspace settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={company.name}
                    onChange={(e) =>
                      setCompany({ ...company, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={company.website}
                    onChange={(e) =>
                      setCompany({ ...company, website: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={company.industry}
                    onValueChange={(value) =>
                      setCompany({ ...company, industry: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Retail">Retail</SelectItem>
                      <SelectItem value="Manufacturing">
                        Manufacturing
                      </SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-size">Company Size</Label>
                  <Select
                    value={company.size}
                    onValueChange={(value) =>
                      setCompany({ ...company, size: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10 employees">
                        1-10 employees
                      </SelectItem>
                      <SelectItem value="11-50 employees">
                        11-50 employees
                      </SelectItem>
                      <SelectItem value="51-200 employees">
                        51-200 employees
                      </SelectItem>
                      <SelectItem value="201-500 employees">
                        201-500 employees
                      </SelectItem>
                      <SelectItem value="500+ employees">
                        500+ employees
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-description">Company Description</Label>
                <Textarea
                  id="company-description"
                  placeholder="Describe your company..."
                  value={company.description}
                  onChange={(e) =>
                    setCompany({ ...company, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={async () => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        companyWebsite: company.website,
                        companyIndustry: company.industry,
                        companySize: company.size,
                        companyDescription: company.description,
                      });
                      showToast.success("Company settings updated successfully");
                    } catch (error) {
                      console.error("Company settings update failed:", error);
                      showToast.error("Failed to update company settings");
                    }
                  }}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, email: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted">
                      Receive push notifications on your devices
                    </p>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, push: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Desktop Notifications</Label>
                    <p className="text-sm text-muted">
                      Show notifications on your desktop
                    </p>
                  </div>
                  <Switch
                    checked={notifications.desktop}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, desktop: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Marketing Communications</Label>
                    <p className="text-sm text-muted">
                      Receive updates about new features and promotions
                    </p>
                  </div>
                  <Switch
                    checked={notifications.marketing}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, marketing: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={async () => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        emailNotifications: notifications.email,
                        pushNotifications: notifications.push,
                        desktopNotifications: notifications.desktop,
                        marketingCommunications: notifications.marketing,
                      });
                      showToast.success("Notification preferences saved successfully!");
                    } catch (error) {
                      console.error("Failed to save preferences:", error);
                      showToast.error("Failed to save preferences");
                    }
                  }}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Switch
                    checked={security.twoFactorEnabled}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, twoFactorEnabled: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={async () => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        twoFactorEnabled: security.twoFactorEnabled,
                      });
                      showToast.success("Security settings updated successfully");
                    } catch (error) {
                      console.error("Security settings update failed:", error);
                      showToast.error("Failed to update security settings");
                    }
                  }}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <h3 className="font-semibold">Pro Plan</h3>
                  <p className="text-sm text-muted">
                    $29/month • Billed monthly
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Active
                </Badge>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Payment Method</h4>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-6 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
                      VISA
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-muted">Expires 12/25</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Update
                  </Button>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline">View Billing History</Button>
                <Button variant="destructive">Cancel Subscription</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Settings */}
        <TabsContent value="team" className="space-y-6">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Manage team permissions and workspace settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow team members to invite others</Label>
                    <p className="text-sm text-muted">
                      Team members can send invitations to new users
                    </p>
                  </div>
                  <Switch
                    checked={security.allowTeamInvites}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, allowTeamInvites: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require admin approval for new members</Label>
                    <p className="text-sm text-muted">
                      New team members need admin approval before joining
                    </p>
                  </div>
                  <Switch
                    checked={security.requireAdminApproval}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, requireAdminApproval: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow file sharing with external users</Label>
                    <p className="text-sm text-muted">
                      Team members can share files with people outside the
                      workspace
                    </p>
                  </div>
                  <Switch
                    checked={security.allowExternalSharing}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, allowExternalSharing: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={async () => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        allowTeamInvites: security.allowTeamInvites,
                        requireAdminApproval: security.requireAdminApproval,
                        allowExternalSharing: security.allowExternalSharing,
                      });
                      showToast.success("Team settings updated successfully");
                    } catch (error) {
                      console.error("Team settings update failed:", error);
                      showToast.error("Failed to update team settings");
                    }
                  }}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
