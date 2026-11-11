import { FormEvent, useEffect, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type RoomType = { id: string; code: string; name: string; baseRateMinor: number };
type Room = { id: string; code: string; status: string; roomTypeId: string; branchId: string; roomType?: RoomType };
type Branch = { id: string; name: string; code: string };
type Reservation = {
  id: string;
  status: string;
  guestName: string;
  guestPhone?: string | null;
  checkInDate: string;
  checkOutDate: string;
  stays?: Array<{ id: string; roomId: string; status: string }>;
  folio?: { id: string; balanceMinor: number; status: string } | null;
};
type Folio = {
  id: string;
  guestName: string;
  status: string;
  balanceMinor: number;
  charges?: Array<{ id: string; description: string | null; amountMinor: number; saleId?: string | null }>;
};

export function HotelPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<"rooms" | "reservations" | "folios">("rooms");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [folios, setFolios] = useState<Folio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [typeForm, setTypeForm] = useState({ code: "", name: "", baseRate: "" });
  const [roomForm, setRoomForm] = useState({ code: "", roomTypeId: "", branchId: "" });
  const [resForm, setResForm] = useState({
    branchId: "",
    guestName: "",
    guestPhone: "",
    roomTypeId: "",
    checkIn: "",
    checkOut: "",
  });
  const [checkInRoom, setCheckInRoom] = useState<Record<string, string>>({});
  const [postSaleId, setPostSaleId] = useState("");
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");

  async function load() {
    const [types, rms, res, fol, br] = await Promise.all([
      apiRequest<RoomType[]>("/hotel/room-types", { token }),
      apiRequest<Room[]>("/hotel/rooms", { token }),
      apiRequest<Reservation[]>("/hotel/reservations", { token }),
      apiRequest<Folio[]>("/hotel/folios", { token }),
      apiRequest<Branch[] | { data: Branch[] }>("/branches", { token }),
    ]);
    setRoomTypes(Array.isArray(types) ? types : []);
    setRooms(Array.isArray(rms) ? rms : []);
    setReservations(Array.isArray(res) ? res : []);
    setFolios(Array.isArray(fol) ? fol : []);
    const branchList = Array.isArray(br) ? br : br.data ?? [];
    setBranches(branchList);
    if (!roomForm.branchId && branchList[0]) {
      setRoomForm((f) => ({ ...f, branchId: branchList[0]!.id }));
      setResForm((f) => ({ ...f, branchId: f.branchId || branchList[0]!.id }));
    }
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, [token]);

  async function createType(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/hotel/room-types", {
        method: "POST",
        token,
        body: {
          code: typeForm.code,
          name: typeForm.name,
          baseRateMinor: Math.round(Number(typeForm.baseRate || 0) * 100),
        },
      });
      setTypeForm({ code: "", name: "", baseRate: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create type failed");
    }
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/hotel/rooms", {
        method: "POST",
        token,
        body: {
          code: roomForm.code,
          roomTypeId: roomForm.roomTypeId,
          branchId: roomForm.branchId,
        },
      });
      setRoomForm((f) => ({ ...f, code: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create room failed");
    }
  }

  async function createReservation(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await apiRequest("/hotel/reservations", {
        method: "POST",
        token,
        body: {
          branchId: resForm.branchId,
          guestName: resForm.guestName,
          guestPhone: resForm.guestPhone || undefined,
          roomTypeId: resForm.roomTypeId || undefined,
          checkInDate: resForm.checkIn,
          checkOutDate: resForm.checkOut,
        },
      });
      setInfo("Reservation created");
      setResForm((f) => ({ ...f, guestName: "", guestPhone: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed");
    }
  }

  async function checkIn(id: string) {
    const roomId = checkInRoom[id];
    if (!roomId) {
      setError("Select a room before check-in");
      return;
    }
    setError(null);
    try {
      await apiRequest(`/hotel/reservations/${id}/check-in`, {
        method: "POST",
        token,
        body: { roomId },
      });
      setInfo("Checked in — folio opened");
      await load();
      setTab("folios");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    }
  }

  async function checkOutStay(stayId: string) {
    setError(null);
    try {
      await apiRequest(`/hotel/stays/${stayId}/check-out`, { method: "POST", token });
      setInfo("Checked out");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-out failed");
    }
  }

  async function postSaleToFolio() {
    if (!selectedFolioId || !postSaleId) return;
    setError(null);
    setInfo(null);
    try {
      await apiRequest(`/hotel/folios/${selectedFolioId}/charges`, {
        method: "POST",
        token,
        body: { saleId: postSaleId },
      });
      setPostSaleId("");
      setInfo("Sale posted to folio (no duplicate revenue)");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Posting failed");
    }
  }

  async function settleFolio() {
    if (!selectedFolioId) return;
    const folio = folios.find((f) => f.id === selectedFolioId);
    const amount = settleAmount ? Math.round(Number(settleAmount) * 100) : folio?.balanceMinor ?? 0;
    setError(null);
    try {
      await apiRequest(`/hotel/folios/${selectedFolioId}/settle`, {
        method: "POST",
        token,
        body: { method: "cash", amountMinor: amount },
      });
      setInfo("Folio settled");
      setSettleAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settle failed");
    }
  }

  async function setRoomStatus(id: string, status: string) {
    await apiRequest(`/hotel/rooms/${id}/status`, { method: "PATCH", token, body: { status } });
    await load();
  }

  return (
    <AppShell title="Hotel & accommodation" description="Rooms, reservations, housekeeping, and guest folios — separate from product inventory.">
      {error ? <p className="mb-2 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {info ? <p className="mb-2 text-sm text-emerald-700">{info}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(["rooms", "reservations", "folios"] as const).map((t) => (
          <Button key={t} type="button" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      {tab === "rooms" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createType(e)}>
            <p className="font-semibold">Room type</p>
            <Input label="Code" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} />
            <Input label="Name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
            <Input label="Base rate" value={typeForm.baseRate} onChange={(e) => setTypeForm({ ...typeForm, baseRate: e.target.value })} />
            <Button type="submit">Create type</Button>
            <ul className="mt-3 space-y-1 text-sm">
              {roomTypes.map((t) => (
                <li key={t.id}>{t.code} — {t.name}</li>
              ))}
            </ul>
          </form>
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createRoom(e)}>
            <p className="font-semibold">Room</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Branch</span>
              <select
                className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
                value={roomForm.branchId}
                onChange={(e) => setRoomForm({ ...roomForm, branchId: e.target.value })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <Input label="Code" value={roomForm.code} onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Type</span>
              <select
                className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
                value={roomForm.roomTypeId}
                onChange={(e) => setRoomForm({ ...roomForm, roomTypeId: e.target.value })}
              >
                <option value="">Select…</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Create room</Button>
            <ul className="mt-3 space-y-2 text-sm">
              {rooms.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--soko-color-border)] pt-2">
                  <span>{r.code} · {r.status} · {r.roomType?.name ?? ""}</span>
                  <span className="flex flex-wrap gap-1">
                    {["available", "dirty", "cleaning", "maintenance", "out_of_service"].map((s) => (
                      <button key={s} type="button" className="text-xs text-[var(--soko-color-primary)]" onClick={() => void setRoomStatus(r.id, s)}>
                        {s}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </form>
        </div>
      ) : null}

      {tab === "reservations" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createReservation(e)}>
            <p className="font-semibold">New reservation</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Branch</span>
              <select
                className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
                value={resForm.branchId}
                onChange={(e) => setResForm({ ...resForm, branchId: e.target.value })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <Input label="Guest name" value={resForm.guestName} onChange={(e) => setResForm({ ...resForm, guestName: e.target.value })} />
            <Input label="Phone" value={resForm.guestPhone} onChange={(e) => setResForm({ ...resForm, guestPhone: e.target.value })} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Room type</span>
              <select
                className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
                value={resForm.roomTypeId}
                onChange={(e) => setResForm({ ...resForm, roomTypeId: e.target.value })}
              >
                <option value="">Any</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <Input label="Check-in" type="date" value={resForm.checkIn} onChange={(e) => setResForm({ ...resForm, checkIn: e.target.value })} />
            <Input label="Check-out" type="date" value={resForm.checkOut} onChange={(e) => setResForm({ ...resForm, checkOut: e.target.value })} />
            <Button type="submit">Book</Button>
          </form>
          <div className="overflow-x-auto lg:col-span-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-[var(--soko-color-text-muted)]">
                  <th className="py-2">Guest</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Room</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const stay = r.stays?.find((s) => s.status === "in_house");
                  return (
                    <tr key={r.id} className="border-t border-[var(--soko-color-border)]">
                      <td className="py-2">{r.guestName}</td>
                      <td>{String(r.checkInDate).slice(0, 10)} → {String(r.checkOutDate).slice(0, 10)}</td>
                      <td>{r.status}</td>
                      <td>
                        {stay ? (
                          rooms.find((x) => x.id === stay.roomId)?.code ?? stay.roomId.slice(0, 8)
                        ) : (
                          <select
                            className="rounded border border-[var(--soko-color-border)] bg-transparent px-2 py-1 text-xs"
                            value={checkInRoom[r.id] ?? ""}
                            onChange={(e) => setCheckInRoom({ ...checkInRoom, [r.id]: e.target.value })}
                          >
                            <option value="">Assign room…</option>
                            {rooms.filter((x) => x.status === "available").map((x) => (
                              <option key={x.id} value={x.id}>{x.code}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="space-x-2">
                        {r.status === "confirmed" ? (
                          <button type="button" className="text-[var(--soko-color-primary)]" onClick={() => void checkIn(r.id)}>Check-in</button>
                        ) : null}
                        {stay ? (
                          <button type="button" className="text-[var(--soko-color-primary)]" onClick={() => void checkOutStay(stay.id)}>Check-out</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "folios" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ul className="space-y-2 text-sm">
            {folios.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left ${selectedFolioId === f.id ? "border-[var(--soko-color-primary)]" : "border-[var(--soko-color-border)]"}`}
                  onClick={() => setSelectedFolioId(f.id)}
                >
                  <span className="font-medium">{f.guestName}</span> · {f.status} · balance {f.balanceMinor}
                  <ul className="mt-2 text-xs text-[var(--soko-color-text-muted)]">
                    {(f.charges ?? []).map((c) => (
                      <li key={c.id}>{c.description} · {c.amountMinor}{c.saleId ? " · sale-linked" : ""}</li>
                    ))}
                  </ul>
                </button>
              </li>
            ))}
            {!folios.length ? <li className="text-[var(--soko-color-text-muted)]">No folios yet — check in a guest first.</li> : null}
          </ul>
          <div className="space-y-4 rounded-lg border border-[var(--soko-color-border)] p-4">
            <div>
              <p className="font-semibold">Post existing sale to folio</p>
              <p className="mt-1 text-xs text-[var(--soko-color-text-muted)]">
                Links the original sale via saleId. Does not create a second sale or double-count revenue.
              </p>
              <Input className="mt-3" label="Sale ID" value={postSaleId} onChange={(e) => setPostSaleId(e.target.value)} />
              <Button className="mt-2" type="button" disabled={!selectedFolioId} onClick={() => void postSaleToFolio()}>
                Post charge
              </Button>
            </div>
            <div>
              <p className="font-semibold">Settle folio</p>
              <Input label="Amount (blank = balance)" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} />
              <Button className="mt-2" type="button" disabled={!selectedFolioId} onClick={() => void settleFolio()}>
                Settle cash
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}