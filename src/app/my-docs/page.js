import { createClient } from '@/lib/supabase-server'
import { getUser } from '@/lib/auth'
import MyDocsClient from './MyDocsClient'

// My Docs (Group Documents) — server component.
//
// Ported from the myltcapps Group Docs feature (/group-folders), with Dataverse
// replaced by Supabase: document rows live in biz_group_documents and the file
// bytes in the private `group-documents` storage bucket. RLS scopes every read
// to the caller's facility; which groups' documents a user browses is client
// UX (members see their groups + All Staff, group leaders get admin tools).
//
// Groups opt into Group Docs via biz_groups.use_group_docs — the "Group Docs"
// toggle on the My Groups edit modal — so only participating groups appear.

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: appMeta }, { data: gData }, { data: memberships }] = await Promise.all([
    supabase
      .from('biz_apps')
      .select('app_name, app_icon, app_icon_emoji')
      .eq('app_link', '/my-docs')
      .maybeSingle(),
    supabase
      .from('biz_groups')
      .select('id, name')
      .eq('active', true)
      .eq('use_group_docs', true)
      .order('name'),
    user?.id
      ? supabase
          .from('biz_group_members')
          .select('group_id, is_admin')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  // The ported client speaks `group_name` (the myltcapps column); alias it.
  const groups = (gData || []).map((g) => ({ id: g.id, group_name: g.name }))

  let documents = []
  if (user?.role === 'demo') {
    // Demo accounts get placeholder documents instead of real facility data.
    const opsGroup = groups.find((g) => g.group_name === 'Operations')?.id || null
    const hrGroup = groups.find((g) => g.group_name === 'HR Group')?.id || null
    const fieldGroup = groups.find((g) => g.group_name === 'Field Team')?.id || null

    const demoDoc = (id, group, groupName, folder, subfolder, name, type, size) => ({
      id: `demo-${id}`,
      group_id: group,
      group_name: group ? groupName : 'All Staff',
      folder_name: folder,
      subfolder_name: subfolder || '',
      document_name: name,
      file_name: name,
      file_type: type,
      file_size_kb: size,
      uploaded_by: 'Admin',
      is_active: true,
      is_hidden: false,
      is_archived: false,
      storage_path: null,
    })

    documents = [
      demoDoc('1', opsGroup, 'Operations', 'Procedures', 'Opening', 'Opening Checklist.pdf', 'pdf', 89),
      demoDoc('2', opsGroup, 'Operations', 'Procedures', 'Closing', 'Closing Checklist.pdf', 'pdf', 76),
      demoDoc('3', opsGroup, 'Operations', 'Procedures', '', 'Equipment Maintenance Log.xlsx', 'xlsx', 45),
      demoDoc('4', opsGroup, 'Operations', 'Safety', '', 'Emergency Action Plan.pdf', 'pdf', 567),
      demoDoc('5', opsGroup, 'Operations', 'Safety', '', 'Incident Report Form.docx', 'docx', 52),
      demoDoc('6', hrGroup, 'HR Group', 'Employee Handbook', '', 'Employee Handbook 2026.pdf', 'pdf', 1200),
      demoDoc('7', hrGroup, 'HR Group', 'Employee Handbook', '', 'Code of Conduct.pdf', 'pdf', 98),
      demoDoc('8', hrGroup, 'HR Group', 'Onboarding', '', 'New Employee Checklist.pdf', 'pdf', 56),
      demoDoc('9', hrGroup, 'HR Group', 'Onboarding', '', 'Direct Deposit Form.pdf', 'pdf', 42),
      demoDoc('10', hrGroup, 'HR Group', 'Templates', '', 'PTO Request Form.pdf', 'pdf', 34),
      demoDoc('11', hrGroup, 'HR Group', 'Templates', '', 'Performance Review Template.docx', 'docx', 52),
      demoDoc('12', fieldGroup, 'Field Team', 'Job Sheets', '', 'Service Call Worksheet.pdf', 'pdf', 61),
      demoDoc('13', fieldGroup, 'Field Team', 'Job Sheets', '', 'Parts Order Form.pdf', 'pdf', 38),
      demoDoc('14', fieldGroup, 'Field Team', 'Reference', '', 'Truck Inventory List.xlsx', 'xlsx', 89),
      demoDoc('15', null, 'All Staff', 'Company Policies', '', 'Time Off Policy.pdf', 'pdf', 112),
      demoDoc('16', null, 'All Staff', 'Company Policies', '', 'Expense Reimbursement Policy.pdf', 'pdf', 97),
    ]
  } else {
    // RLS already scopes to the caller's facility; keep only documents that
    // belong to a participating group (or All Staff), mirroring the source.
    const { data: docs } = await supabase
      .from('biz_group_documents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1000)
    const groupIds = new Set(groups.map((g) => g.id))
    documents = (docs || []).filter((d) => !d.group_id || groupIds.has(d.group_id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <MyDocsClient
        appIcon={appMeta?.app_icon || appMeta?.app_icon_emoji || '📄'}
        appName={appMeta?.app_name || 'My Docs'}
        userEmail={user?.email || null}
        userRole={user?.role || null}
        facilityId={user?.facility_id || null}
        initialMemberships={memberships || []}
        initialGroups={groups}
        initialDocuments={documents}
      />
    </div>
  )
}
