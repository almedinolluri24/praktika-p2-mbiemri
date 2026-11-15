<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

class BroadcastChannelAuthController extends Controller
{
    public function authorize(Request $request)
    {
        $data = $request->validate([
            'socket_id' => ['required', 'string', 'max:100'],
            'channel_name' => ['required', 'string', 'max:200'],
        ]);

        $channel = preg_replace('/^private-/', '', $data['channel_name']);
        $user = $request->user();
        $authorized = false;

        if (preg_match('/^branches\.(\d+)$/', $channel, $matches)) {
            $authorized = $user->isAdministrator() || $user->hasBranchRole((int) $matches[1], User::STAFF_ROLES);
        } elseif (preg_match('/^orders\.customer\.(\d+)$/', $channel, $matches)) {
            $authorized = $user->id === (int) $matches[1];
        } elseif (preg_match('/^orders\.(\d+)$/', $channel, $matches)) {
            $order = Order::find((int) $matches[1]);
            $authorized = $order && ($user->isAdministrator()
                || $order->customer_id === $user->id
                || $user->hasBranchRole($order->branch_id, User::STAFF_ROLES));
        }

        abort_unless($authorized, 403);

        if (! in_array(config('broadcasting.default'), ['log', 'null'], true)) {
            return Broadcast::auth($request);
        }

        // The log broadcaster has no signature protocol; this response is for local authorization checks only.
        return response()->json(['authorized' => true]);
    }
}
