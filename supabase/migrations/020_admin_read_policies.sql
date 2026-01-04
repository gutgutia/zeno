-- Migration: Add admin read policies for user management
-- This allows admin users to view all profiles and related tables

-- ============================================
-- ADD ADMIN POLICY FOR PROFILES
-- ============================================
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR USER_CREDITS
-- ============================================
CREATE POLICY "Admins can view all user credits"
  ON public.user_credits FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update user credits"
  ON public.user_credits FOR UPDATE
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert user credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR CREDIT_TRANSACTIONS
-- ============================================
CREATE POLICY "Admins can view all credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert credit transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR DASHBOARDS
-- ============================================
CREATE POLICY "Admins can view all dashboards"
  ON public.dashboards FOR SELECT
  USING (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR ORGANIZATIONS
-- ============================================
CREATE POLICY "Admins can view all organizations"
  ON public.organizations FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update all organizations"
  ON public.organizations FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR ORGANIZATION_MEMBERS
-- ============================================
CREATE POLICY "Admins can view all org members"
  ON public.organization_members FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update org members"
  ON public.organization_members FOR UPDATE
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete org members"
  ON public.organization_members FOR DELETE
  USING (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR ORGANIZATION_CREDITS
-- ============================================
CREATE POLICY "Admins can view all org credits"
  ON public.organization_credits FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update org credits"
  ON public.organization_credits FOR UPDATE
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert org credits"
  ON public.organization_credits FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- ============================================
-- ADD ADMIN POLICY FOR ORGANIZATION_INVITATIONS
-- ============================================
CREATE POLICY "Admins can view all org invitations"
  ON public.organization_invitations FOR SELECT
  USING (is_admin_user(auth.uid()));
