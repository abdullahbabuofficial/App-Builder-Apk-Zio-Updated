import { useEffect, useState } from 'react';
import { Camera, Mail, Phone, MapPin, Globe, Calendar } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../contexts/auth-context';

function splitName(full?: string | null): { first: string; last: string } {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return { first: '', last: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export function ProfilePage() {
  const { user } = useAuth();
  const initial = user?.full_name?.trim()?.[0]?.toUpperCase() ?? '?';
  const { first: derivedFirst, last: derivedLast } = splitName(user?.full_name);

  const [firstName, setFirstName] = useState(derivedFirst);
  const [lastName, setLastName] = useState(derivedLast);
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');

  useEffect(() => {
    const next = splitName(user?.full_name);
    setFirstName(next.first);
    setLastName(next.last);
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setBio(user?.bio ?? '');
    setLocation(user?.location ?? '');
    setWebsite(user?.website ?? '');
  }, [user]);

  const planLabel = user?.plan
    ? `${user.plan.charAt(0).toUpperCase()}${user.plan.slice(1)} Plan`
    : 'Free Plan';

  return (
    <DashboardLayout currentPage="profile">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal information</p>
        </div>

        {/* Banner */}
        <div className="relative bg-gradient-to-br from-primary via-secondary to-accent rounded-2xl h-48 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23fff%22 fill-opacity=%220.1%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 -mt-20 px-6">
          {/* Sidebar */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="relative w-32 h-32 mx-auto">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-4xl font-bold">
                {initial}
              </div>
              <button className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center hover:bg-muted">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="text-center mt-4">
              <h3 className="font-semibold">{user?.full_name || 'Your name'}</h3>
              <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
              <Badge className="mt-2 bg-gradient-to-r from-primary to-secondary">{planLabel}</Badge>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{user?.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{user?.phone || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{user?.location || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span className="truncate">{user?.website || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{user?.email_verified ? 'Email verified' : 'Email not verified'}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="mb-4 font-semibold">Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Your last name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, country"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Bio</Label>
                  <Textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us a bit about what you build."
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline">Cancel</Button>
              <Button className="bg-gradient-to-r from-primary to-secondary">Save Changes</Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
