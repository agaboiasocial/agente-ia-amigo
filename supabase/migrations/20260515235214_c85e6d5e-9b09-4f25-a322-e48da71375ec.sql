INSERT INTO public.user_roles (user_id, role)
SELECT '7190f75e-b9a9-4e5a-a47e-f676b24e5dd1'::uuid, 'admin'::app_role
ON CONFLICT (user_id, role) DO NOTHING;