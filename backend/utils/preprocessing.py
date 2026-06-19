import pandas as pd
import ast


def load_dataset(csv_path):
    df = pd.read_csv(csv_path)
    return df


def clean_data(df):
    cols_to_drop = [
        'description',
        'action_taken_timestamp',
        'closed_datetime',
        'data_sent_to_scita_timestamp',
        'updated_vehicle_number',
        'updated_vehicle_type',
        'validation_timestamp',
        'device_id',
        'created_by_id'
    ]

    df.drop(columns=cols_to_drop, inplace=True)

    df.dropna(subset=['police_station', 'junction_name'], inplace=True)

    df['location'].fillna('Unknown Location', inplace=True)
    df['center_code'] = df['center_code'].astype(str).fillna('Unknown')

    df = df[df['validation_status'] != 'rejected']
    df['validation_status'] = df['validation_status'].fillna('unvalidated')

    df['violation_type'] = df['violation_type'].apply(
        lambda x: ast.literal_eval(x) if isinstance(x, str) else x
    )

    df['is_parking_violation'] = df['violation_type'].apply(
        lambda x: 1 if any('PARKING' in v for v in x) else 0
    )

    df = df[df['is_parking_violation'] == 1]

    return df


def feature_engineering(df):
    df['created_datetime'] = pd.to_datetime(df['created_datetime'], utc=True)
    df['created_datetime'] = df['created_datetime'].dt.tz_convert('Asia/Kolkata')

    df['hour'] = df['created_datetime'].dt.hour
    df['day_of_week'] = df['created_datetime'].dt.dayofweek
    df['month'] = df['created_datetime'].dt.month
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

    hourly_counts = df['hour'].value_counts().sort_index()
    peak_threshold = hourly_counts.mean() + 0.5 * hourly_counts.std()
    PEAK_HOURS = set(hourly_counts[hourly_counts >= peak_threshold].index.tolist())

    df['is_peak'] = df['hour'].apply(lambda h: 1 if h in PEAK_HOURS else 0)

    return df