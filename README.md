# Atlas Rebuild v2

Clean Atlas CRM rebuild based on:

- Atlas v2 Sprint 01
- Sales Workspace Module v1
- Atlas v1.0 Master Repository principles

## Run

```bash
npm install
npm run dev
```

Open the local Vite address shown in terminal.

## Screens

- `/today` Morning Brief
- `/companies` Company Workspace
- `/call` Sales / Call Workspace

## VIAWA Kullanıcısı Ekleme

VIAWA şirket içi bir uygulamadır — herkese açık kayıt (sign-up) yoktur.
Yeni bir EXPOVIA çalışanının giriş yapabilmesi için bir yönetici aşağıdaki
adımları Supabase Dashboard üzerinden uygular:

1. Supabase Dashboard açılır.
2. **Authentication → Users** bölümüne gidilir.
3. **Add user** (veya **Invite user**) ile yeni kullanıcı oluşturulur/davet
   edilir — kullanıcının kendi e-posta adresiyle.
4. **Table Editor → `application_users`** tablosunda bu kullanıcı için yeni
   bir satır oluşturulur:
   - `id`: 3. adımda oluşan Auth kullanıcısının `id` değeri (aynı uuid)
   - `email`: kullanıcının e-postası
5. `role` seçilir: `admin` veya `representative`.
6. `is_active` alanı `true` yapılır.
7. Kullanıcı artık VIAWA'ya kendi e-postası ve şifresiyle giriş yapabilir.

`application_users` satırı olmayan veya `is_active = false` olan bir Auth
kullanıcısı, şifresi doğru olsa bile VIAWA arayüzüne veya korunan temel iş
tablolarına erişemez. Veritabanı RLS politikaları bu kontrolü her işlemde
`auth.uid()` üzerinden uygular; yetkili VIAWA kullanıcıları temel iş verilerini
ortak kullanmaya devam eder. Gerçek şifre, token veya secret bu belgeye asla
yazılmaz.
