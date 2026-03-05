import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, User, Search } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type CaregiverPatient = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  ward_id: number | null;
  ward_name: string | null;
  relationship: string;
  linked_at: string;
};

export default function CaregiverPatientsPage() {
  const PAGE_SIZE = 9;
  const { user } = useAuth();
  const [patients, setPatients] = useState<CaregiverPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const canViewMyPatients =
    user?.role === "caregiver" &&
    (!Array.isArray(user?.permissions) ||
      user.permissions.includes("VIEW_PATIENT_RECORD"));

  useEffect(() => {
    if (canViewMyPatients) {
      void fetchMyPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewMyPatients]);

  const fetchMyPatients = async () => {
    try {
      const response = await api.get("/caregivers/my-patients");
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error("Error fetching caregiver patients:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;

    return patients.filter((patient) => {
      const targets =
        searchField === "name"
          ? [patient.name]
          : searchField === "email"
            ? [patient.email]
            : searchField === "relationship"
              ? [patient.relationship]
              : searchField === "ward"
                ? [patient.ward_name || ""]
                : [patient.name, patient.email, patient.relationship, patient.ward_name || ""];

      return targets.some((value) => value.toLowerCase().includes(q));
    });
  }, [patients, searchField, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPatients.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredPatients]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchField, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (!user) return <Navigate to="/login" replace />;
  if (!canViewMyPatients) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-8">
        <Users className="h-8 w-8 text-primary-600 mr-3" />
        <h1 className="text-3xl font-bold text-slate-100">My Patients</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input-field w-full pl-9"
            placeholder="Search linked patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="input-field w-full" value={searchField} onChange={(e) => setSearchField(e.target.value)}>
          <option value="all">Search: All fields</option>
          <option value="name">Search: Name</option>
          <option value="email">Search: Email</option>
          <option value="relationship">Search: Relationship</option>
          <option value="ward">Search: Ward</option>
        </select>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="card text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-slate-300">
            {patients.length === 0 ? "No linked patients found" : "No patients match your search"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedPatients.map((patient) => (
            <div
              key={patient.id}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">
                    {patient.name}
                  </h3>
                  <p className="text-sm text-slate-300">{patient.email}</p>
                </div>
                <div className="bg-primary-500/15 p-2 rounded-full border border-primary-500/25">
                  <User className="h-6 w-6 text-primary-600" />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Relationship:</span>
                  <span className="font-medium capitalize">
                    {patient.relationship}
                  </span>
                </div>
                {patient.ward_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Ward:</span>
                    <span className="font-medium">{patient.ward_name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredPatients.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Page {currentPage} of {totalPages} ({filteredPatients.length} result
            {filteredPatients.length !== 1 ? "s" : ""})
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
